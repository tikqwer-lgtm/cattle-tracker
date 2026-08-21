import { beforeEach, describe, it, expect, vi } from 'vitest';

describe('insemination group add', function () {
  beforeEach(async function () {
    vi.resetModules();
    global.window = global;
    global.getInseminationAttempt = undefined;
    await import('../js/features/action-batch/insemination-group.js');
  });

  it('attemptForCow: новое животное → 1, в стаде → следующий номер', function () {
    var G = global.__inseminationGroup;
    var entries = [
      { cattleId: '101', inseminationHistory: [{ date: '2026-01-01' }, { date: '2026-03-01' }] }
    ];
    function findEntry(id) {
      return entries.find(function (e) { return e.cattleId === id; }) || null;
    }
    expect(G.attemptForCow('999', findEntry)).toBe(1);
    expect(G.attemptForCow('101', findEntry)).toBe(3);
    expect(G.attemptForCow('  ', findEntry)).toBe(null);
  });

  it('buildGroupDraftRows: одинаковые поля, без дублей, попытка 1 / следующая', function () {
    var G = global.__inseminationGroup;
    var entries = [
      { cattleId: '10', inseminationHistory: [{ date: '2026-01-01' }] }
    ];
    function findEntry(id) {
      return entries.find(function (e) { return String(e.cattleId) === String(id); }) || null;
    }
    var rows = G.buildGroupDraftRows(['10', '20', '10', '  ', '20'], ['20'], findEntry, {
      bull: 'Б-1',
      uid: function () { return 'id'; }
    });
    expect(rows).toEqual([
      { id: 'id', cattleId: '10', attemptNumber: 2, bull: 'Б-1' }
    ]);
  });
});
