import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_SEGMENT = 99;

function parseChangelog(text) {
  const entries = [];
  const lines = String(text || '').split(/\r?\n/);
  let current = null;
  let currentSection = null;
  for (const line of lines) {
    const verMatch = line.match(/^## \[([^\]]+)\]\s*-\s*(.+)$/);
    if (verMatch) {
      if (current) entries.push(current);
      current = { version: verMatch[1].trim(), date: verMatch[2].trim(), itemCount: 0 };
      currentSection = null;
      continue;
    }
    if (/^###\s+/.test(line) && current) {
      currentSection = true;
      continue;
    }
    if (/^-\s+.+/.test(line) && current && currentSection) {
      current.itemCount += 1;
    }
  }
  if (current) entries.push(current);
  return entries;
}

function parseSemver(ver) {
  const parts = String(ver || '')
    .split('.')
    .map((s) => parseInt(s, 10));
  while (parts.length < 3) parts.push(0);
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
}

function nextVersion(ver) {
  const { major, minor, patch } = parseSemver(ver);
  if (patch < MAX_SEGMENT) return `${major}.${minor}.${patch + 1}`;
  if (minor < MAX_SEGMENT) return `${major}.${minor + 1}.0`;
  return `${major + 1}.0.0`;
}

function skippedVersions(from, to) {
  const skipped = [];
  let cursor = nextVersion(from);
  const guard = 200;
  let n = 0;
  while (cursor !== to && n < guard) {
    skipped.push(cursor);
    cursor = nextVersion(cursor);
    n += 1;
  }
  return skipped;
}

describe('CHANGELOG.md covers every released version', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  const entries = parseChangelog(changelog);

  it('has a non-empty section for the current package.json version', () => {
    const current = entries.find((e) => e.version === pkg.version);
    expect(current, `Нет секции ## [${pkg.version}] в CHANGELOG.md`).toBeTruthy();
    expect(current.itemCount, `Секция ${pkg.version} пустая — нужен хотя бы один пункт для пользователя`).toBeGreaterThan(0);
  });

  it('does not skip version numbers between documented releases', () => {
    const versions = entries.map((e) => e.version).reverse();
    const gaps = [];
    for (let i = 0; i < versions.length - 1; i++) {
      const expectedNext = nextVersion(versions[i]);
      if (versions[i + 1] !== expectedNext) {
        gaps.push(
          `${versions[i]} → ${versions[i + 1]} (пропущены ${skippedVersions(versions[i], versions[i + 1]).join(', ')})`
        );
      }
    }
    expect(gaps, `Пропущены версии в CHANGELOG.md:\n${gaps.join('\n')}`).toEqual([]);
  });

  it('every documented version has at least one bullet', () => {
    const empty = entries.filter((e) => e.itemCount < 1).map((e) => e.version);
    expect(empty, `Пустые секции: ${empty.join(', ')}`).toEqual([]);
  });
});
