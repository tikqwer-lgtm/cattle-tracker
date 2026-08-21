/**
 * Парсинг и объединение CHANGELOG.md (приложение + тесты).
 */

function parseSemverParts(ver) {
  var parts = String(ver || '')
    .split('.')
    .map(function (s) {
      return parseInt(s, 10) || 0;
    });
  while (parts.length < 3) parts.push(0);
  return parts;
}

function compareVersionsDesc(a, b) {
  var pa = parseSemverParts(a);
  var pb = parseSemverParts(b);
  for (var i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i];
  }
  return 0;
}

function parseChangelogMarkdown(text) {
  var entries = [];
  if (!text) return entries;
  var lines = String(text).split(/\r?\n/);
  var current = null;
  var currentSection = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var verMatch = line.match(/^## \[([^\]]+)\]\s*-\s*(.+)$/);
    if (verMatch) {
      if (current) entries.push(current);
      current = { version: verMatch[1].trim(), date: verMatch[2].trim(), sections: [] };
      currentSection = null;
      continue;
    }
    var secMatch = line.match(/^###\s+(.+)$/);
    if (secMatch && current) {
      currentSection = { title: secMatch[1].trim(), items: [] };
      current.sections.push(currentSection);
      continue;
    }
    var itemMatch = line.match(/^-\s+(.+)$/);
    if (itemMatch && current) {
      if (!currentSection) {
        currentSection = { title: 'Изменено', items: [] };
        current.sections.push(currentSection);
      }
      currentSection.items.push(itemMatch[1].trim());
    }
  }
  if (current) entries.push(current);
  return entries;
}

function countChangelogItems(entry) {
  if (!entry || !Array.isArray(entry.sections)) return 0;
  var n = 0;
  for (var i = 0; i < entry.sections.length; i++) {
    var items = entry.sections[i] && entry.sections[i].items;
    if (Array.isArray(items)) n += items.length;
  }
  return n;
}

function mergeChangelogEntries(listA, listB) {
  var map = {};
  function ingest(list) {
    if (!Array.isArray(list)) return;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || !e.version) continue;
      var key = String(e.version).trim();
      if (!map[key]) {
        map[key] = { version: key, date: e.date || '', sections: [] };
      }
      if (e.date && (!map[key].date || String(e.date) > String(map[key].date))) {
        map[key].date = e.date;
      }
      var sections = e.sections || [];
      for (var s = 0; s < sections.length; s++) {
        var sec = sections[s];
        if (!sec) continue;
        var title = sec.title || 'Изменено';
        var dest = null;
        for (var d = 0; d < map[key].sections.length; d++) {
          if (map[key].sections[d].title === title) {
            dest = map[key].sections[d];
            break;
          }
        }
        if (!dest) {
          dest = { title: title, items: [] };
          map[key].sections.push(dest);
        }
        var items = sec.items || [];
        for (var k = 0; k < items.length; k++) {
          var item = items[k];
          if (item && dest.items.indexOf(item) === -1) dest.items.push(item);
        }
      }
    }
  }
  ingest(listA);
  ingest(listB);
  return Object.keys(map)
    .sort(compareVersionsDesc)
    .map(function (k) {
      return map[k];
    });
}

function changelogHasVersionItems(text, version) {
  var entries = parseChangelogMarkdown(text);
  var ver = String(version || '').trim();
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].version === ver) return countChangelogItems(entries[i]) > 0;
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.parseChangelogMarkdown = parseChangelogMarkdown;
  window.mergeChangelogEntries = mergeChangelogEntries;
  window.countChangelogItems = countChangelogItems;
}

export {
  parseChangelogMarkdown,
  mergeChangelogEntries,
  countChangelogItems,
  changelogHasVersionItems,
  compareVersionsDesc
};
