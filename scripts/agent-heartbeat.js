/**
 * Heartbeat агента: node scripts/agent-heartbeat.js working|idle
 * Те же учётные данные, что у ideas:pull.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');

function stripBom(s) {
  if (!s || s.charCodeAt(0) !== 0xfeff) return s;
  return s.slice(1);
}

function applyEnvFile(raw) {
  raw = stripBom(String(raw || ''));
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] == null || process.env[k] === '') process.env[k] = v;
  }
}

['.env', '.env.local', 'mobile-installer.env'].forEach(function (name) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) return;
  try {
    applyEnvFile(fs.readFileSync(p, 'utf8'));
  } catch (e) {}
});

function parseServerAddressFile() {
  const p = path.join(root, 'server', 'server-address.txt');
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  const line = raw.split(/\r?\n/).find((l) => /^\s*SERVER_IP\s*=/.test(l));
  if (!line) return null;
  const m = line.match(/SERVER_IP\s*=\s*(\S+)/);
  return m ? m[1].trim() : null;
}

function getApiBase() {
  let base = (process.env.CATTLE_TRACKER_API_BASE || '').trim().replace(/\/$/, '');
  if (base.length >= 4 && base.slice(-4).toLowerCase() === '/api') {
    base = base.slice(0, -4).replace(/\/$/, '');
  }
  if (base) return base;
  const ip = parseServerAddressFile();
  if (!ip) {
    console.error('Задайте CATTLE_TRACKER_API_BASE или server/server-address.txt');
    process.exit(1);
  }
  const port = (process.env.CATTLE_TRACKER_API_PORT || '3000').trim();
  return `http://${ip}:${port}`;
}

async function loginToken(apiBase) {
  const token = (process.env.CATTLE_TRACKER_APK_UPLOAD_TOKEN || process.env.CATTLE_TRACKER_API_TOKEN || '').trim();
  if (token) return token;
  const u = (process.env.CATTLE_TRACKER_APK_UPLOAD_USER || '').trim();
  const p = (process.env.CATTLE_TRACKER_APK_UPLOAD_PASSWORD || '').trim();
  if (!u || !p) {
    console.error('Нет учётки admin.');
    process.exit(1);
  }
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Вход:', res.status, data.error || data.message || '');
    process.exit(1);
  }
  return String(data.token || '').trim();
}

async function main() {
  const phase = String(process.argv[2] || 'idle').trim().toLowerCase() === 'working' ? 'working' : 'idle';
  const apiBase = getApiBase();
  const token = await loginToken(apiBase);
  const intervalMinutes = parseInt(process.env.CATTLE_TRACKER_AGENT_INTERVAL_MINUTES || '30', 10);
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/admin/agent-heartbeat`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phase: phase,
      intervalMinutes: isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 30,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('heartbeat:', res.status, data.error || '');
    process.exit(1);
  }
  const st = data.status || {};
  console.log('phase:', st.phase || phase);
  if (st.nextPollAt) console.log('nextPollAt:', st.nextPollAt);
}

main().catch(function (e) {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
