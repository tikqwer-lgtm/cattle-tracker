import { describe, it, expect } from 'vitest';
import {
  reportKind,
  filterPendingImprovements,
  formatAgentNextTime,
  agentLampState
} from '../js/features/agent-status-format.js';

describe('reportKind / filterPendingImprovements', () => {
  it('читает kind из JSON-строки payload', () => {
    expect(reportKind({ payload: '{"kind":"improvement"}' })).toBe('improvement');
    expect(reportKind({ payload: { kind: 'bug' } })).toBe('bug');
    expect(reportKind({ payload: '{' })).toBe('');
  });

  it('оставляет только новые предложения', () => {
    const reports = [
      { id: '1', status: 'new', payload: { kind: 'improvement' }, message: 'A' },
      { id: '2', status: 'done', payload: { kind: 'improvement' }, message: 'B' },
      { id: '3', status: 'new', payload: { kind: 'error' }, message: 'C' },
      { id: '4', message: 'D' }
    ];
    expect(filterPendingImprovements(reports).map((r) => r.id)).toEqual(['1']);
  });
});

describe('formatAgentNextTime', () => {
  it('для working показывает «сейчас»', () => {
    expect(formatAgentNextTime({ phase: 'working' })).toBe('сейчас');
  });

  it('форматирует nextPollAt как часы:минуты', () => {
    const d = new Date(2026, 7, 21, 14, 5, 0);
    expect(formatAgentNextTime({ phase: 'idle', nextPollAt: d.toISOString() })).toBe('14:05');
  });

  it('без статуса — тире', () => {
    expect(formatAgentNextTime(null)).toBe('—');
    expect(formatAgentNextTime({ phase: 'idle' })).toBe('—');
  });
});

describe('agentLampState', () => {
  const now = Date.parse('2026-08-21T12:00:00.000Z');

  it('unknown без lastSeenAt', () => {
    expect(agentLampState(null, now)).toBe('unknown');
    expect(agentLampState({}, now)).toBe('unknown');
  });

  it('working при свежем heartbeat', () => {
    expect(
      agentLampState({ phase: 'working', lastSeenAt: '2026-08-21T11:55:00.000Z' }, now)
    ).toBe('working');
  });

  it('stale если working слишком давно', () => {
    expect(
      agentLampState({ phase: 'working', lastSeenAt: '2026-08-21T11:00:00.000Z' }, now)
    ).toBe('stale');
  });

  it('ok если idle и nextPoll ещё впереди', () => {
    expect(
      agentLampState(
        {
          phase: 'idle',
          lastSeenAt: '2026-08-21T11:50:00.000Z',
          nextPollAt: '2026-08-21T12:20:00.000Z'
        },
        now
      )
    ).toBe('ok');
  });

  it('stale если nextPoll давно прошёл', () => {
    expect(
      agentLampState(
        {
          phase: 'idle',
          lastSeenAt: '2026-08-21T10:00:00.000Z',
          nextPollAt: '2026-08-21T10:30:00.000Z'
        },
        now
      )
    ).toBe('stale');
  });
});
