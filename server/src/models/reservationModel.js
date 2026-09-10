const db = require('../config/db');

async function createReservation({ userId, courtId, date, startTime, endTime }) {
  const [result] = await db.query(
    `INSERT INTO reservations (user_id, court_id, date, start_time, end_time, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [userId, courtId, date, startTime, endTime]
  );
  return { id: result.insertId, userId, courtId, date, startTime, endTime, status: 'pending' };
}

async function findOverlapping({ courtId, date, startTime, endTime }) {
  const [rows] = await db.query(
    `SELECT * FROM reservations
     WHERE court_id = ? AND date = ? AND status IN ('pending', 'approved')
     AND NOT (end_time <= ? OR start_time >= ?)`,
    [courtId, date, startTime, endTime]
  );
  return rows;
}

async function updateStatus(id, status) {
  await db.query(`UPDATE reservations SET status = ? WHERE id = ?`, [status, id]);
}

module.exports = { createReservation, findOverlapping, updateStatus };
