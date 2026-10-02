// Creates (or updates) the admin account from ADMIN_EMAIL / ADMIN_PASSWORD in .env
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/config/db');

(async () => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'Admin' } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first.');
    process.exit(1);
  }
  try {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified)
       VALUES (?, ?, ?, 'admin', TRUE)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin', email_verified = TRUE`,
      [ADMIN_NAME, ADMIN_EMAIL, hash]
    );
    console.log(`Admin account ready: ${ADMIN_EMAIL}`);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();