const eventBus = require('../events/bus');
const { getIO } = require('../sockets');
const db = require('../config/db');
const { sendApprovalEmail } = require('../utils/mailer');

eventBus.on('reservation.validated', async (reservation) => {
  try {
    const [rows] = await db.query(`SELECT name FROM users WHERE id = ?`, [reservation.userId]);
    const userName = rows[0]?.name || 'Unknown resident';
    getIO().to('admins').emit('newReservation', { ...reservation, userName });
  } catch (err) {
    console.error('Notifier enrichment error:', err);
    getIO().to('admins').emit('newReservation', reservation);
  }

  // Broadcast live update if the reservation is marked as public
  if (reservation.isPublic || reservation.is_public) {
    getIO().emit('publicEventPosted');
  }
});

eventBus.on('reservation.approved', async (reservation) => {
  getIO().to(`user:${reservation.userId}`).emit('statusUpdate', {
    id: reservation.id,
    status: 'approved',
  });

  try {
    const [rows] = await db.query(
      `SELECT r.date, r.start_time, u.email, c.name AS court_name
       FROM reservations r JOIN users u ON r.user_id = u.id JOIN courts c ON r.court_id = c.id
       WHERE r.id = ?`,
      [reservation.id]
    );
    const info = rows[0];
    if (info) {
      await sendApprovalEmail(info.email, { courtName: info.court_name, date: info.date, startTime: info.start_time });
    }
  } catch (err) {
    console.error('Approval email failed:', err);
  }
});

eventBus.on('reservation.rejected', (reservation) => {
  getIO().to(`user:${reservation.userId}`).emit('statusUpdate', {
    id: reservation.id,
    status: 'rejected',
  });
});