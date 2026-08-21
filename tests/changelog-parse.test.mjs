import { describe, it, expect } from 'vitest';
import {
  parseChangelogMarkdown,
  mergeChangelogEntries,
  countChangelogItems,
  changelogHasVersionItems
} from '../js/features/changelog-parse.js';

describe('parseChangelogMarkdown', () => {
  it('берёт пункты без ### в секцию Изменено', () => {
    const entries = parseChangelogMarkdown(
      '## [0.1.0] - 2026-08-21\n- Первый пункт\n'
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].version).toBe('0.1.0');
    expect(entries[0].sections[0].title).toBe('Изменено');
    expect(entries[0].sections[0].items).toEqual(['Первый пункт']);
    expect(countChangelogItems(entries[0])).toBe(1);
  });

  it('сохраняет пункты под ###', () => {
    const entries = parseChangelogMarkdown(
      '## [0.1.1] - 2026-08-21\n### Добавлено\n- Кнопка\n'
    );
    expect(entries[0].sections[0].title).toBe('Добавлено');
    expect(entries[0].sections[0].items).toEqual(['Кнопка']);
  });
});

describe('mergeChangelogEntries', () => {
  it('объединяет версии с сервера и из APK', () => {
    const server = parseChangelogMarkdown('## [0.1.0] - 2026-08-20\n- Старое\n');
    const local = parseChangelogMarkdown('## [0.1.1] - 2026-08-21\n- Новое\n');
    const merged = mergeChangelogEntries(server, local);
    expect(merged.map((e) => e.version)).toEqual(['0.1.1', '0.1.0']);
    expect(merged[0].sections[0].items).toContain('Новое');
    expect(merged[1].sections[0].items).toContain('Старое');
  });

  it('не теряет пункты одной версии из двух источников', () => {
    const a = parseChangelogMarkdown('## [0.2.0] - 2026-08-21\n- А\n');
    const b = parseChangelogMarkdown('## [0.2.0] - 2026-08-21\n### Исправлено\n- Б\n');
    const merged = mergeChangelogEntries(a, b);
    expect(merged).toHaveLength(1);
    expect(countChangelogItems(merged[0])).toBe(2);
  });
});

describe('changelogHasVersionItems', () => {
  it('true если есть пункт', () => {
    expect(changelogHasVersionItems('## [1.0.0] - 2026-01-01\n- x\n', '1.0.0')).toBe(true);
  });
  it('false если секции нет', () => {
    expect(changelogHasVersionItems('## [1.0.0] - 2026-01-01\n- x\n', '1.0.1')).toBe(false);
  });
});
