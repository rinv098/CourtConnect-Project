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

module.exports = { findByEmail, findById, createUser };