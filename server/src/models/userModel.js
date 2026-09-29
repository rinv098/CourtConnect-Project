const db = require('../config/db');

async function findByEmail(email) {
  const [rows] = await db.query(`SELECT * FROM users WHERE email = ?`, [email]);
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await db.query(`SELECT id, name, email, role FROM users WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function createUser({ name, email, passwordHash, role = 'resident' }) {
  const [result] = await db.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`,
    [name, email, passwordHash, role]
  );
  return { id: result.insertId, name, email, role };
}

async function updateProfile(userId, { name, avatarUrl }) {
  await db.query(`UPDATE users SET name = ?, avatar_url = ? WHERE id = ?`, [name, avatarUrl, userId]);
  const [rows] = await db.query(`SELECT id, name, email, role, avatar_url FROM users WHERE id = ?`, [userId]);
  return rows[0];
}

module.exports = { findByEmail, findById, createUser, updateProfile };