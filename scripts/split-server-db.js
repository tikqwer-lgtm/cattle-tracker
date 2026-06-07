/**
 * Split server/db.js into server/db/*.js modules + facade.
 * Run once: node scripts/split-server-db.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcPath = path.join(root, 'server', 'db.js');
const src = fs.readFileSync(srcPath, 'utf8');
const lines = src.split('\n');

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const dbDir = path.join(root, 'server', 'db');
fs.mkdirSync(dbDir, { recursive: true });

const coreBody = [
  slice(5, 55),
  slice(57, 138),
  slice(141, 224),
  slice(226, 242),
  slice(357, 374),
].join('\n\n').replace(
  "path.join(__dirname, 'data')",
  "path.join(__dirname, '..', 'data')"
);

fs.writeFileSync(
  path.join(dbDir, 'core.js'),
  `/**
 * Database core: sql.js connection, schema, migrations, SQL helpers.
 */
${coreBody}

module.exports = {
  initDb,
  initSchema,
  saveDb,
  runSql,
  getSql,
  allSql,
  parseJsonColumn,
  normalizeVwpDays,
};
`
);

const usersBody = slice(486, 552);
fs.writeFileSync(
  path.join(dbDir, 'users.js'),
  `const { runSql, getSql, allSql, saveDb } = require('./core');

${usersBody}

module.exports = {
  createUser,
  findUserByUsername,
  findUserById,
  findUserByIdWithPassword,
  getAllUsers,
  countUsers,
  countAdmins,
  updateUserRole,
  deleteUser,
  setPasswordHashForUsername,
};
`
);

const reportsBody = slice(554, 595);
fs.writeFileSync(
  path.join(dbDir, 'reports.js'),
  `const { runSql, getSql, allSql, saveDb } = require('./core');

${reportsBody}

module.exports = {
  createReport,
  getReportById,
  getReports,
  deleteReport,
};
`
);

const objectsBody = slice(597, 703);
fs.writeFileSync(
  path.join(dbDir, 'objects.js'),
  `const { runSql, getSql, allSql, saveDb } = require('./core');

${objectsBody}

module.exports = {
  getObjects,
  getObjectsWithMeta,
  getObjectById,
  getObjectWithCreatedBy,
  findObjectIdWithDuplicateNameForCreator,
  createObject,
  updateObject,
  deleteObject,
};
`
);

const entryHelpers = slice(376, 484);
const entriesBody = slice(705, 807);
fs.writeFileSync(
  path.join(dbDir, 'entries.js'),
  `const { runSql, getSql, allSql, saveDb } = require('./core');

${entryHelpers}

${entriesBody}

module.exports = {
  rowToEntry,
  entryToRow,
  getEntries,
  getEntry,
  createEntry,
  cloneEntriesToObject,
  updateEntry,
  deleteEntry,
  entryExists,
};
`
);

const protocolsBody = slice(809, 868);
fs.writeFileSync(
  path.join(dbDir, 'protocols.js'),
  `const { runSql, getSql, allSql, saveDb } = require('./core');

${protocolsBody}

module.exports = {
  getProtocols,
  getProtocolById,
  createProtocol,
  updateProtocol,
  deleteProtocol,
};
`
);

const stallBody = slice(870, 909);
fs.writeFileSync(
  path.join(dbDir, 'stall-layout.js'),
  `const { runSql, getSql, saveDb } = require('./core');
const { getObjectById } = require('./objects');

${stallBody}

module.exports = {
  getStallLayout,
  putStallLayout,
};
`
);

const farmCardBody = slice(246, 331);
const cloneLayersBody = slice(333, 354);
fs.writeFileSync(
  path.join(dbDir, 'farm-card.js'),
  `const { runSql, getSql, saveDb, parseJsonColumn, normalizeVwpDays } = require('./core');
const { getObjectById } = require('./objects');
const { getProtocols, createProtocol } = require('./protocols');
const { getStallLayout, putStallLayout } = require('./stall-layout');

const EMPTY_FARM_SETTINGS = { technicians: [], bulls: [], drugs: [], vwpDays: 60 };

${farmCardBody}

${cloneLayersBody}

module.exports = {
  getObjectProfile,
  putObjectProfile,
  getFarmSettings,
  putFarmSettings,
  getFarmCardBundle,
  replaceFarmCardBundle,
  cloneObjectLayers,
};
`
);

fs.writeFileSync(
  path.join(root, 'server', 'db.js'),
  `/**
 * Database access layer facade (users, objects, entries, protocols, farm card).
 */
const core = require('./db/core');
const users = require('./db/users');
const reports = require('./db/reports');
const objects = require('./db/objects');
const entries = require('./db/entries');
const protocols = require('./db/protocols');
const stallLayout = require('./db/stall-layout');
const farmCard = require('./db/farm-card');

module.exports = {
  ...core,
  ...users,
  ...reports,
  ...objects,
  ...entries,
  ...protocols,
  ...stallLayout,
  ...farmCard,
};
`
);

const origPath = path.join(root, 'server', 'db.js.orig');
if (!fs.existsSync(origPath)) {
  fs.writeFileSync(origPath, src);
  console.log('Backed up to server/db.js.orig');
}

console.log('Split server/db.js into server/db/*.js');
