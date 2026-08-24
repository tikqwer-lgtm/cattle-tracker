import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('server/db/agent-status', () => {
  let dir;
  let prevPath;
  let prevInterval;
  let agentStatus;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agent-status-'));
    prevPath = process.env.CATTLE_TRACKER_AGENT_STATUS_PATH;
    prevInterval = process.env.CATTLE_TRACKER_AGENT_INTERVAL_MINUTES;
    process.env.CATTLE_TRACKER_AGENT_STATUS_PATH = join(dir, 'agent-status.json');
    process.env.CATTLE_TRACKER_AGENT_INTERVAL_MINUTES = '30';
    agentStatus = require('../server/db/agent-status.js');
  });

  afterEach(() => {
    if (prevPath == null) delete process.env.CATTLE_TRACKER_AGENT_STATUS_PATH;
    else process.env.CATTLE_TRACKER_AGENT_STATUS_PATH = prevPath;
    if (prevInterval == null) delete process.env.CATTLE_TRACKER_AGENT_INTERVAL_MINUTES;
    else process.env.CATTLE_TRACKER_AGENT_INTERVAL_MINUTES = prevInterval;
    rmSync(dir, { recursive: true, force: true });
  });

  it('ставит working без nextPollAt, idle — со следующим опросом', () => {
    const working = agentStatus.setAgentHeartbeat({ phase: 'working' });
    expect(working.phase).toBe('working');
    expect(working.lastSeenAt).toBeTruthy();

    const idle = agentStatus.setAgentHeartbeat({ phase: 'idle', intervalMinutes: 15 });
    expect(idle.phase).toBe('idle');
    const next = Date.parse(idle.nextPollAt);
    const last = Date.parse(idle.lastSeenAt);
    expect(next - last).toBe(15 * 60 * 1000);
  });

  it('фильтрует необработанные предложения', () => {
    const pending = agentStatus.pendingImprovements([
      { id: '1', status: 'new', payload: { kind: 'improvement' }, message: 'A', createdAt: 't' },
      { id: '2', status: 'done', payload: { kind: 'improvement' }, message: 'B' }
    ]);
    expect(pending).toEqual([{ id: '1', message: 'A', createdAt: 't', username: '' }]);
  });
});
