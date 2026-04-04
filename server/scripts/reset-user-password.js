/**
 * Сброс пароля пользователя по логину (локально на машине с файлом БД).
 * Запускать при остановленном сервере или если sql.js допускает одновременный доступ (лучше остановить API).
 *
 * Usage: node scripts/reset-user-password.js <username> <new-password>
 * Example: node scripts/reset-user-password.js Panko 123456
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../db');

async function main() {
  const user = (process.argv[2] || '').trim();
  const pass = process.argv[3] || '';
  if (!user || !pass) {
    console.error('Использование: node scripts/reset-user-password.js <логин> <новый_пароль>');
    console.error('Пример: node scripts/reset-user-password.js Panko 123456');
    process.exit(1);
  }
  await db.initDb();
  db.initSchema();
  const hash = bcrypt.hashSync(pass, 10);
  const ok = db.setPasswordHashForUsername(user, hash);
  if (!ok) {
    console.error('Пользователь не найден:', user);
    process.exit(1);
  }
  console.log('Пароль обновлён для пользователя:', user);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
