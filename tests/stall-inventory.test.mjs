import { describe, it, expect } from 'vitest';
import {
  buildStallChecklist,
  buildYardCells,
  createInventorySession,
  recordCellCheck,
  recordUnassignedCheck,
  computeInventoryResult,
  collectApplyUpdates,
  finishInventorySession,
  cattleIdEqual
} from '../js/features/stall-inventory-core.js';

describe('stall-inventory-core', () => {
  var layout = { yards: { '1': { rows: 2, cols: 2 } } };
  var entries = [
    { cattleId: '101', nickname: 'A', group: 'G1', stallYard: '1', stallRow: 1, stallPlace: 1 },
    { cattleId: '102', nickname: 'B', group: 'G1', stallYard: '1', stallRow: 1, stallPlace: 2 },
    { cattleId: '200', nickname: 'NoStall', group: 'G2' }
  ];

  it('buildStallChecklist sorts occupied and lists unassigned', () => {
    var cl = buildStallChecklist(layout, entries);
    expect(cl.occupiedCells).toHaveLength(2);
    expect(cl.occupiedCells[0].cattleId).toBe('101');
    expect(cl.unassigned).toHaveLength(1);
    expect(cl.unassigned[0].cattleId).toBe('200');
  });

  it('buildYardCells returns grid with expected animals', () => {
    var cells = buildYardCells(layout, '1', entries);
    expect(cells).toHaveLength(4);
    expect(cells[0].expected.cattleId).toBe('101');
    expect(cells[1].expected.cattleId).toBe('102');
    expect(cells[2].expected).toBeNull();
  });

  it('ok check produces no moved', () => {
    var session = createInventorySession('default', '1', entries);
    recordCellCheck(session, '1', 1, 1, 'ok');
    recordCellCheck(session, '1', 1, 2, 'ok');
    recordCellCheck(session, '1', 2, 1, 'empty');
    recordCellCheck(session, '1', 2, 2, 'empty');
    recordUnassignedCheck(session, '200', 'not_found');
    finishInventorySession(session, { early: false });
    var result = computeInventoryResult(session, entries, { layout: layout, yardCells: buildYardCells(layout, '1', entries) });
    expect(result.moved).toHaveLength(0);
    expect(result.withoutPlace.stillWithout).toHaveLength(1);
    expect(result.withoutPlace.notChecked).toHaveLength(0);
    expect(result.uncheckedCells).toHaveLength(0);
    expect(result.unallocated).toHaveLength(1);
    expect(result.unallocated[0].cattleId).toBe('200');
  });

  it('empty at expected stall marks animal as moved and unallocated', () => {
    var session = createInventorySession('default', '1', entries);
    recordCellCheck(session, '1', 1, 1, 'empty');
    finishInventorySession(session, { early: true });
    var yardCells = buildYardCells(layout, '1', entries);
    var result = computeInventoryResult(session, entries, { layout: layout, yardCells: yardCells });
    expect(result.moved.some(function (m) { return cattleIdEqual(m.cattleId, '101'); })).toBe(true);
    expect(result.unallocated.some(function (u) { return cattleIdEqual(u.cattleId, '101') && u.reason === 'не найдено на месте'; })).toBe(true);
  });

  it('unknown animal at stall goes to newAnimals and marks expected as moved', () => {
    var session = createInventorySession('default', '1', entries);
    recordCellCheck(session, '1', 1, 1, 'other', '999', true);
    finishInventorySession(session, { early: true });
    var result = computeInventoryResult(session, entries, { layout: layout, yardCells: buildYardCells(layout, '1', entries) });
    expect(result.moved.some(function (m) { return cattleIdEqual(m.cattleId, '101'); })).toBe(true);
    expect(result.newAnimals).toHaveLength(1);
    expect(result.newAnimals[0].cattleId).toBe('999');
    expect(result.newAnimals[0].foundAt.row).toBe(1);
  });

  it('unassigned found goes to foundDuringCheck', () => {
    var session = createInventorySession('default', '1', entries);
    recordUnassignedCheck(session, '200', 'found', { yard: '1', row: 2, place: 1 });
    finishInventorySession(session, { early: false });
    var result = computeInventoryResult(session, entries, { layout: layout, yardCells: buildYardCells(layout, '1', entries) });
    expect(result.withoutPlace.foundDuringCheck).toHaveLength(1);
    expect(result.withoutPlace.stillWithout).toHaveLength(0);
    expect(result.newAnimals).toHaveLength(0);
    var updates = collectApplyUpdates(session, result);
    expect(updates).toHaveLength(1);
    expect(updates[0].stallRow).toBe(2);
  });

  it('early finish leaves unchecked cells and pending unassigned in notChecked and unallocated', () => {
    var session = createInventorySession('default', '1', entries);
    recordCellCheck(session, '1', 1, 1, 'ok');
    finishInventorySession(session, { early: true });
    var yardCells = buildYardCells(layout, '1', entries);
    var result = computeInventoryResult(session, entries, { layout: layout, yardCells: yardCells });
    expect(result.moved).toHaveLength(0);
    expect(result.uncheckedCells).toHaveLength(3);
    expect(result.withoutPlace.notChecked).toHaveLength(1);
    expect(result.withoutPlace.notChecked[0].cattleId).toBe('200');
    expect(result.withoutPlace.stillWithout).toHaveLength(0);
    expect(result.unallocated.some(function (u) { return cattleIdEqual(u.cattleId, '200'); })).toBe(true);
    expect(result.newAnimals).toHaveLength(0);
  });

  it('full run with not_found unassigned does not use notChecked', () => {
    var session = createInventorySession('default', '1', entries);
    recordCellCheck(session, '1', 1, 1, 'ok');
    recordCellCheck(session, '1', 1, 2, 'ok');
    recordCellCheck(session, '1', 2, 1, 'empty');
    recordCellCheck(session, '1', 2, 2, 'empty');
    recordUnassignedCheck(session, '200', 'not_found');
    finishInventorySession(session, { early: false });
    var result = computeInventoryResult(session, entries, { layout: layout, yardCells: buildYardCells(layout, '1', entries) });
    expect(result.withoutPlace.stillWithout).toHaveLength(1);
    expect(result.withoutPlace.notChecked).toHaveLength(0);
    expect(result.newAnimals).toHaveLength(0);
    expect(result.unallocated.filter(function (u) { return cattleIdEqual(u.cattleId, '200'); })).toHaveLength(1);
  });
});
