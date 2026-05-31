import { describe, it, expect } from 'vitest';
import {
  buildStallChecklist,
  buildYardCells,
  createInventorySession,
  recordCellCheck,
  recordUnassignedCheck,
  computeInventoryResult,
  collectApplyUpdates,
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
    var result = computeInventoryResult(session, entries);
    expect(result.moved).toHaveLength(0);
    expect(result.withoutPlace.stillWithout).toHaveLength(1);
  });

  it('empty at expected stall marks animal as moved', () => {
    var session = createInventorySession('default', '1', entries);
    recordCellCheck(session, '1', 1, 1, 'empty');
    var result = computeInventoryResult(session, entries);
    expect(result.moved.some(function (m) { return cattleIdEqual(m.cattleId, '101'); })).toBe(true);
  });

  it('other animal at stall marks both as moved when applicable', () => {
    var session = createInventorySession('default', '1', entries);
    recordCellCheck(session, '1', 1, 1, 'other', '999');
    var result = computeInventoryResult(session, entries);
    expect(result.moved.some(function (m) { return cattleIdEqual(m.cattleId, '101'); })).toBe(true);
  });

  it('unassigned found goes to foundDuringCheck', () => {
    var session = createInventorySession('default', '1', entries);
    recordUnassignedCheck(session, '200', 'found', { yard: '1', row: 2, place: 1 });
    var result = computeInventoryResult(session, entries);
    expect(result.withoutPlace.foundDuringCheck).toHaveLength(1);
    expect(result.withoutPlace.stillWithout).toHaveLength(0);
    var updates = collectApplyUpdates(session, result);
    expect(updates).toHaveLength(1);
    expect(updates[0].stallRow).toBe(2);
  });
});
