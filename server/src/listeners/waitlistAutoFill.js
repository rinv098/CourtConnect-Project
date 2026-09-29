const eventBus = require('../events/bus');
const waitlistModel = require('../models/waitlistModel');
const reservationModel = require('../models/reservationModel');
const db = require('../config/db');
const { getIO } = require('../sockets');

eventBus.on('reservation.cancelled', async (reservation) => {
  try {
    // The cancel route only emits { id }, so fetch full details first
    const [rows] = await db.query(`SELECT * FROM reservations WHERE id = ?`, [reservation.id]);
    const cancelled = rows[0];
    if (!cancelled) return;

    const nextInLine = await waitlistModel.findNextInLine({
      courtId: cancelled.court_id,
      date: cancelled.date,
      startTime: cancelled.start_time,
      endTime: cancelled.end_time,
    });

    if (!nextInLine) return; // nobody waiting for this exact slot

    const newReservation = await reservationModel.createReservation({
      userId: nextInLine.user_id,
      courtId: nextInLine.court_id,
      date: nextInLine.date,
      startTime: nextInLine.start_time,
      endTime: nextInLine.end_time,
      status: 'pending',
    });

    await waitlistModel.updateStatus(nextInLine.id, 'offered');

    // Re-emit so conflictChecker and auditLogger react to this new reservation too
    eventBus.emit('reservation.requested', newReservation);

    // Notify the waitlisted user in real time, if they're connected
    try {
      getIO().to(`user:${nextInLine.user_id}`).emit('waitlistOffer', {
        message: 'A slot you were waitlisted for is now available!',
        reservation: newReservation,
      });
    } catch (socketErr) {
      console.error('Socket notify failed (non-fatal):', socketErr.message);
    }
  } catch (err) {
    console.error('Waitlist auto-fill error:', err);
  }
});