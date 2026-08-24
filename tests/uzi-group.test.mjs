/**
 * Групповой ввод УЗИ: номер, дубль, результат.
 */
import { describe, it, expect, beforeAll } from 'vitest';

describe('makeUziGroupRow', () => {
  let makeUziGroupRow;
  let uidSeq = 0;

  beforeAll(async () => {
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = globalThis;
    }
    globalThis.window.__actionBatch = {
      uid: function () {
        uidSeq += 1;
        return 'u' + uidSeq;
      },
      batchGuardKey: function (a, b) {
        return String(a || '') + '|' + String(b || '');
      },
      getEntries: function () { return []; },
      resolveEntryForAction: function () { return null; },
      newAnimalHintHtml: function () { return ''; },
      toast: function () {},
      toastSaveError: function () {},
      bindOnce: function () {},
      openOverlay: function () {},
      closeTopModal: function () {},
      refocusActiveActionBatchNumberInput: function () {},
      computeUziDays: function () { return null; },
      runSequentialUpdates: function () { return Promise.resolve(); },
      runSequentialCreates: function () { return Promise.resolve(); },
      defaultSpecialist: function () { return ''; },
      fillOperatorField: function () {},
      confirmMissingAnimal: function () { return Promise.resolve(true); },
      escapeHtml: function (s) { return String(s || ''); },
      draftRowWarnClass: function () { return ''; },
      clearRowBatchGuard: function () {}
    };
    await import('../js/features/action-batch/action-batch-uzi.js');
    makeUziGroupRow = globalThis.window.__uziGroup.makeUziGroupRow;
  });

  it('отклоняет пустой номер', () => {
    const r = makeUziGroupRow([], '  ', 'Стельная', null, '2026-08-24');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('empty');
  });

  it('отклоняет дубль номера', () => {
    const draft = [{ cattleId: '101' }];
    const r = makeUziGroupRow(draft, '101', 'Стельная', null, '2026-08-24');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('dup');
  });

  it('отклоняет пустой результат', () => {
    const r = makeUziGroupRow([], '101', '', null, '2026-08-24');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('result');
  });

  it('добавляет строку с номером и результатом', () => {
    const r = makeUziGroupRow([], ' 77 ', 'Не стельная', 32, '2026-08-24');
    expect(r.ok).toBe(true);
    expect(r.row.cattleId).toBe('77');
    expect(r.row.result).toBe('Не стельная');
    expect(r.row.daysFromInsemination).toBe(32);
    expect(r.row._batchGuardKey).toBe('2026-08-24|');
  });
});
