/**
 * Create SQLite schema: users, objects, entries.
 * Run: node scripts/init-db.js
 * Uses the same db module as the server (sql.js).
 */
const path = require('path');
const db = require('../db');

async function main() {
  await db.initDb();
  db.initSchema();
  console.log('DB initialized at', path.join(__dirname, '..', 'data', 'cattle.db'));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
