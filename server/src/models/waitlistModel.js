const db = require('../config/db');

async function joinWaitlist({ userId, courtId, date, startTime, endTime }) {
  const [result] = await db.query(
    `INSERT INTO waitlist (user_id, court_id, date, start_time, end_time, status)
     VALUES (?, ?, ?, ?, ?, 'waiting')`,
    [userId, courtId, date, startTime, endTime]
  );
  return { id: result.insertId, userId, courtId, date, startTime, endTime, status: 'waiting' };
}

async function findNextInLine({ courtId, date, startTime, endTime }) {
  const [rows] = await db.query(
    `SELECT * FROM waitlist
     WHERE court_id = ? AND date = ? AND start_time = ? AND end_time = ? AND status = 'waiting'
     ORDER BY created_at ASC LIMIT 1`,
    [courtId, date, startTime, endTime]
  );
  return rows[0] || null;
}

async function updateStatus(id, status) {
  await db.query(`UPDATE waitlist SET status = ? WHERE id = ?`, [status, id]);
}

async function findByUser(userId) {
  const [rows] = await db.query(
    `SELECT w.*, c.name AS court_name
     FROM waitlist w
     JOIN courts c ON w.court_id = c.id
     WHERE w.user_id = ?
     ORDER BY w.created_at DESC`,
    [userId]
  );
  return rows;
}

async function findAll() {
  const [rows] = await db.query(
    `SELECT w.*, u.name AS user_name, u.avatar_url, c.name AS court_name
     FROM waitlist w
     JOIN users u ON w.user_id = u.id
     JOIN courts c ON w.court_id = c.id
     ORDER BY w.created_at DESC`
  );
  return rows;
}

async function getPosition(id) {
  const [[entry]] = await db.query(`SELECT court_id, date, start_time, created_at FROM waitlist WHERE id = ?`, [id]);
  if (!entry) return null;
  const [[{ position }]] = await db.query(
    `SELECT COUNT(*) AS position FROM waitlist
     WHERE court_id = ? AND date = ? AND start_time = ? AND status = 'waiting' AND created_at <= ?`,
    [entry.court_id, entry.date, entry.start_time, entry.created_at]
  );
  return position;
}

module.exports = { joinWaitlist, findNextInLine, updateStatus, findByUser, findAll, getPosition};