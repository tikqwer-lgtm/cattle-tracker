/**
 * Heartbeat облачного агента (лампочка «А» в приложении).
 * Файл server/data/agent-status.json — не коммитить.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_INTERVAL_MIN = 30;
const MAX_INTERVAL_MIN = 24 * 60;

function statusFilePath() {
  if (process.env.CATTLE_TRACKER_AGENT_STATUS_PATH) {
    return process.env.CATTLE_TRACKER_AGENT_STATUS_PATH;
  }
  return path.join(__dirname, '..', 'data', 'agent-status.json');
}

function readStatus() {
  const p = statusFilePath();
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (e) {
    return null;
  }
}

function writeStatus(data) {
  const p = statusFilePath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeIntervalMinutes(value) {
  let n = parseInt(value, 10);
  if (!isFinite(n) || n < 1) {
    n = parseInt(process.env.CATTLE_TRACKER_AGENT_INTERVAL_MINUTES, 10);
  }
  if (!isFinite(n) || n < 1) n = DEFAULT_INTERVAL_MIN;
  return Math.min(MAX_INTERVAL_MIN, Math.max(1, n));
}

function getAgentStatus() {
  const data = readStatus() || {};
  return {
    phase: data.phase === 'working' ? 'working' : 'idle',
    lastSeenAt: data.lastSeenAt || null,
    nextPollAt: data.nextPollAt || null,
    intervalMinutes: data.intervalMinutes || DEFAULT_INTERVAL_MIN
  };
}

function setAgentHeartbeat(input) {
  const prev = getAgentStatus();
  const phase = input && input.phase === 'working' ? 'working' : 'idle';
  const intervalMinutes = normalizeIntervalMinutes(input && input.intervalMinutes);
  const now = new Date();
  const lastSeenAt = now.toISOString();
  let nextPollAt = null;
  if (phase === 'idle') {
    nextPollAt = new Date(now.getTime() + intervalMinutes * 60 * 1000).toISOString();
  } else {
    nextPollAt = prev.nextPollAt || null;
  }
  const data = {
    phase: phase,
    lastSeenAt: lastSeenAt,
    nextPollAt: nextPollAt,
    intervalMinutes: intervalMinutes
  };
  writeStatus(data);
  return data;
}

function improvementKind(report) {
  try {
    const pl =
      typeof report.payload === 'string' ? JSON.parse(report.payload) : report.payload;
    return pl && pl.kind ? String(pl.kind) : '';
  } catch (e) {
    return '';
  }
}

function pendingImprovements(reports) {
  return (reports || []).filter(function (r) {
    return improvementKind(r) === 'improvement' && String(r.status || 'new') === 'new';
  }).map(function (r) {
    return {
      id: r.id,
      message: r.message || '',
      createdAt: r.createdAt || '',
      username: r.username || ''
    };
  });
}

module.exports = {
  getAgentStatus,
  setAgentHeartbeat,
  pendingImprovements,
  statusFilePath
};
