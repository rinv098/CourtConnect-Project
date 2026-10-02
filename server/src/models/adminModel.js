const db = require('../config/db');



async function getStats() {
  const [[activeReservations]] = await db.query(
    `SELECT COUNT(*) AS count FROM reservations WHERE status IN ('pending', 'approved') AND date >= CURDATE()`
  );
  const [[pendingApprovals]] = await db.query(
    `SELECT COUNT(*) AS count FROM reservations WHERE status = 'pending'`
  );
  const [[waitlistSize]] = await db.query(
    `SELECT COUNT(*) AS count FROM waitlist WHERE status = 'waiting'`
  );
  const [[publicEvents]] = await db.query(
    `SELECT COUNT(*) AS count FROM reservations WHERE is_public = TRUE AND status = 'approved' AND date >= CURDATE()`
  );
  const [[totalResidents]] = await db.query(
    `SELECT COUNT(*) AS count FROM users WHERE role = 'resident'`
  );
  const [[courtCounts]] = await db.query(
    `SELECT COUNT(*) AS total, SUM(status = 'available') AS available FROM courts`
  );

  return {
    activeReservations: activeReservations.count,
    pendingApprovals: pendingApprovals.count,
    waitlistSize: waitlistSize.count,
    publicEvents: publicEvents.count,
    totalResidents: totalResidents.count,
    courtsAvailable: courtCounts.available,
    courtsTotal: courtCounts.total,
  };
}

async function getCourtOccupancyToday() {
  const [rows] = await db.query(
    `SELECT c.id, c.name,
            COUNT(r.id) AS booked_slots
     FROM courts c
     LEFT JOIN reservations r
       ON r.court_id = c.id AND r.date = CURDATE() AND r.status IN ('pending', 'approved')
     GROUP BY c.id, c.name
     ORDER BY c.name`
  );
  const TOTAL_SLOTS_PER_DAY = 7; 
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    occupancyPercent: Math.round((r.booked_slots / TOTAL_SLOTS_PER_DAY) * 100),
  }));
}

async function getRecentActivity(limit = 8) {
  const [rows] = await db.query(
    `SELECT event_type, payload_json, created_at FROM audit_log ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return rows;
}

async function getFullAuditLog() {
  const [rows] = await db.query(`SELECT * FROM audit_log ORDER BY created_at DESC`);
  return rows;
}

async function getLiveNowCount() {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS count FROM reservations
     WHERE status = 'approved' AND date = CURDATE()
     AND start_time <= CURTIME() AND end_time > CURTIME()`
  );
  return row.count;
}

async function getReservationTrend(days = 14) {
  const [rows] = await db.query(
    `SELECT date, COUNT(*) AS count
     FROM reservations
     WHERE status IN ('pending', 'approved')
       AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL ? DAY) AND CURDATE()
     GROUP BY date
     ORDER BY date`,
    [days - 1]
  );

  const toKey = (d) => {
    const dateObj = d instanceof Date ? d : new Date(d);
    return dateObj.toISOString().split('T')[0];
  };

  const countsByDate = new Map(rows.map((r) => [toKey(r.date), r.count]));

  const trend = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    trend.push({ date: key, count: countsByDate.get(key) || 0 });
  }
  return trend;
}

async function getReservationsByMonth(year) {
  const [rows] = await db.query(
    `SELECT MONTH(date) AS month, COUNT(*) AS count
     FROM reservations
     WHERE status IN ('pending', 'approved') AND YEAR(date) = ?
     GROUP BY MONTH(date)`,
    [year]
  );

  const countsByMonth = new Map(rows.map((r) => [r.month, r.count]));

  const trend = [];
  for (let m = 1; m <= 12; m++) {
    trend.push({ month: m, count: countsByMonth.get(m) || 0 });
  }
  return trend;
}

async function getReservationsByDayOfMonth(year, month) {
  const [rows] = await db.query(
    `SELECT DAY(date) AS day, COUNT(*) AS count
     FROM reservations
     WHERE status IN ('pending', 'approved') AND YEAR(date) = ? AND MONTH(date) = ?
     GROUP BY DAY(date)`,
    [year, month]
  );

  const countsByDay = new Map(rows.map((r) => [r.day, r.count]));
  const daysInMonth = new Date(year, month, 0).getDate();

  const trend = [];
  for (let d = 1; d <= daysInMonth; d++) {
    trend.push({ day: d, count: countsByDay.get(d) || 0 });
  }
  return trend;
}

async function getReservationsForDate(date) {
  const [rows] = await db.query(
    `SELECT r.id, r.date, r.start_time, r.end_time, r.status, r.is_public, r.event_title,
            u.name AS user_name, u.email AS user_email, c.name AS court_name
     FROM reservations r
     JOIN users u ON r.user_id = u.id
     JOIN courts c ON r.court_id = c.id
     WHERE r.date = ?
     ORDER BY r.start_time`,
    [date]
  );
  return rows;
}

module.exports = {
  getStats,
  getCourtOccupancyToday,
  getRecentActivity,
  getFullAuditLog,
  getLiveNowCount,
  getReservationTrend,
  getReservationsByMonth,
  getReservationsByDayOfMonth,
  getReservationsForDate,
};