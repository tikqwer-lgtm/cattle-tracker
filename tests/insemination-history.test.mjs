import { describe, it, expect } from 'vitest';
import { removeInseminationFromEntry } from '../js/utils/insemination-history.js';

describe('removeInseminationFromEntry', () => {
  it('удаляет повтор из истории и обновляет дату в карточке', () => {
    const entry = {
      inseminationDate: '2026-08-20',
      attemptNumber: 2,
      bull: 'B2',
      inseminationHistory: [
        { date: '2026-08-10', attemptNumber: 1, bull: 'B1' },
        { date: '2026-08-20', attemptNumber: 2, bull: 'B2' }
      ],
      actionHistory: [
        { action: 'Осеменение', dateTime: '2026-08-20T10:00:00' }
      ]
    };
    expect(removeInseminationFromEntry(entry, 'history', 1)).toBe(true);
    expect(entry.inseminationHistory).toHaveLength(1);
    expect(entry.inseminationDate).toBe('2026-08-10');
    expect(entry.bull).toBe('B1');
    expect(entry.actionHistory).toHaveLength(0);
  });

  it('не трогает чужие события при удалении осеменения из истории действий', () => {
    const entry = {
      inseminationDate: '2026-08-20',
      inseminationHistory: [{ date: '2026-08-20', attemptNumber: 1 }],
      actionHistory: [
        { action: 'УЗИ', dateTime: '2026-08-21' },
        { action: 'Осеменение', dateTime: '2026-08-20T12:00:00' }
      ]
    };
    expect(removeInseminationFromEntry(entry, 'action', 1)).toBe(true);
    expect(entry.actionHistory).toHaveLength(1);
    expect(entry.actionHistory[0].action).toBe('УЗИ');
    expect(entry.inseminationHistory).toHaveLength(0);
  });
});
