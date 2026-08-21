const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');
const CHANGELOG_FALLBACK = path.join(__dirname, '..', '..', 'CHANGELOG.md');

function changelogCandidates() {
  return [CHANGELOG_PATH, CHANGELOG_FALLBACK];
}

function readChangelogFile() {
  const list = changelogCandidates();
  for (let i = 0; i < list.length; i++) {
    try {
      if (fs.existsSync(list[i])) return fs.readFileSync(list[i], 'utf8');
    } catch (e) {
      /* try next */
    }
  }
  return null;
}

function writeChangelogFile(text) {
  fs.writeFileSync(CHANGELOG_PATH, String(text == null ? '' : text), 'utf8');
  return CHANGELOG_PATH;
}

module.exports = {
  CHANGELOG_PATH,
  readChangelogFile,
  writeChangelogFile,
};
