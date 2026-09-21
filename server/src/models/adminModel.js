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
  const TOTAL_SLOTS_PER_DAY = 14; // 8am to 10pm, 1-hour slots
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
module.exports = { getStats, getCourtOccupancyToday, getRecentActivity, getFullAuditLog, getLiveNowCount };