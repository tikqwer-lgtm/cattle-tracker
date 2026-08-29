import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  kindForSubmit,
  reportKind,
  payloadAfterAccept,
  isPendingSuggestion
} = require('../server/lib/report-payload.js');

describe('kindForSubmit', () => {
  it('не-админ не ставит заявку сразу агенту', () => {
    expect(kindForSubmit('inseminator', 'improvement')).toBe('suggestion');
    expect(kindForSubmit('service', 'suggestion')).toBe('suggestion');
  });

  it('админ отправляет improvement агенту', () => {
    expect(kindForSubmit('admin', 'improvement')).toBe('improvement');
  });
});

describe('accept payload', () => {
  it('после Принять kind становится improvement', () => {
    const next = payloadAfterAccept({ kind: 'suggestion', appVersion: '0.7.31' });
    expect(next.kind).toBe('improvement');
    expect(next.appVersion).toBe('0.7.31');
    expect(next.acceptedAt).toMatch(/T/);
  });

  it('новое suggestion ждёт принятия', () => {
    expect(isPendingSuggestion({ kind: 'suggestion' }, 'new')).toBe(true);
    expect(isPendingSuggestion({ kind: 'improvement' }, 'new')).toBe(false);
  });

  it('читает kind из JSON-строки', () => {
    expect(reportKind('{"kind":"suggestion"}')).toBe('suggestion');
  });
});
