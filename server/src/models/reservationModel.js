const db = require('../config/db');

async function createReservation({
  userId, courtId, date, startTime, endTime, status = 'pending',
  isPublic = false, eventTitle = null, eventDescription = null,
  category = null, subCategory = null,
}) {
  const [result] = await db.query(
    `INSERT INTO reservations (user_id, court_id, date, start_time, end_time, status, is_public, event_title, event_description, category, sub_category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, courtId, date, startTime, endTime, status, isPublic, eventTitle, eventDescription, category, subCategory]
  );
  return { id: result.insertId, userId, courtId, date, startTime, endTime, status, isPublic, eventTitle, eventDescription, category, subCategory };
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
// Overlapping reservations created BEFORE this one (lower id). Used for first-come, first-served conflict checks.
async function findEarlierOverlapping({ id, courtId, date, startTime, endTime }) {
  const [rows] = await db.query(
    `SELECT id FROM reservations
     WHERE court_id = ? AND date = ? AND id < ? AND status IN ('pending', 'approved')
     AND NOT (end_time <= ? OR start_time >= ?)`,
    [courtId, date, id, startTime, endTime]
  );
  return rows;
}

async function countActiveInWeek(userId, date) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS count FROM reservations
     WHERE user_id = ? AND status IN ('pending', 'approved')
     AND YEARWEEK(date, 1) = YEARWEEK(?, 1)`,
    [userId, date]
  );
  return row.count;
}

async function updateStatus(id, status) {
  await db.query(`UPDATE reservations SET status = ? WHERE id = ?`, [status, id]);
}

async function findPublicUpcoming() {
  const [rows] = await db.query(
    `SELECT r.*, u.name AS user_name, c.name AS court_name
     FROM reservations r
     JOIN users u ON r.user_id = u.id
     JOIN courts c ON r.court_id = c.id
     WHERE r.is_public = TRUE AND r.status = 'approved' AND r.date >= CURDATE()
     ORDER BY r.date ASC LIMIT 10`
  );
  return rows;
}

async function findScheduleForDate(date) {
  const [rows] = await db.query(
    `SELECT r.id, r.court_id, r.start_time, r.end_time, r.status, r.is_public, r.event_title,
            r.category, r.sub_category, u.name AS user_name
     FROM reservations r
     JOIN users u ON r.user_id = u.id
     WHERE r.date = ? AND r.status IN ('pending', 'approved')`,
    [date]
  );

  return rows.map((r) => ({
    id: r.id,
    courtId: r.court_id,
    startTime: r.start_time,
    endTime: r.end_time,
    status: r.status,
    isPublic: !!r.is_public,
    category: r.category,
    subCategory: r.sub_category,
    label: r.is_public
      ? (r.event_title || `${r.user_name}'s Game`)
      : (r.sub_category || 'Reserved'),
  }));
}

async function findAllWithDetails() {
  const [rows] = await db.query(
    `SELECT r.*, u.name AS user_name, c.name AS court_name
     FROM reservations r
     JOIN users u ON r.user_id = u.id
     JOIN courts c ON r.court_id = c.id
     ORDER BY r.created_at DESC
     LIMIT 50`
  );
  return rows;
}

async function checkIn(id) {
  await db.query(`UPDATE reservations SET checked_in = TRUE WHERE id = ?`, [id]);
}

async function markNoShow(id, userId) {
  await db.query(`UPDATE reservations SET status = 'no_show' WHERE id = ?`, [id]);
  await db.query(`UPDATE users SET no_show_count = no_show_count + 1 WHERE id = ?`, [userId]);
}

module.exports = { createReservation, findOverlapping, updateStatus, findPublicUpcoming, findScheduleForDate, findAllWithDetails, checkIn, markNoShow, findEarlierOverlapping, countActiveInWeek};