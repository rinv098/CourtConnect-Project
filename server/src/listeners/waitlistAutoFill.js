const eventBus = require('../events/bus');
const waitlistModel = require('../models/waitlistModel');
const reservationModel = require('../models/reservationModel');
const db = require('../config/db');
const { getIO } = require('../sockets');
const { WEEKLY_CAP } = require('../constants/limits');
const { manilaDateTime } = require('../utils/time');

eventBus.on('reservation.cancelled', async (reservation) => {
  try {
    // The cancel route only emits { id }, so fetch full details first
    const [rows] = await db.query(`SELECT * FROM reservations WHERE id = ?`, [reservation.id]);
    const cancelled = rows[0];
    if (!cancelled) return;

    // No point offering a slot that has already started
    if (manilaDateTime(cancelled.date, cancelled.start_time) <= new Date()) return;

    const slot = {
      courtId: cancelled.court_id,
      date: cancelled.date,
      startTime: cancelled.start_time,
      endTime: cancelled.end_time,
    };

    // Walk the queue until someone who is still under the weekly cap is found
    let nextInLine;
    while ((nextInLine = await waitlistModel.findNextInLine(slot))) {
      const [[user]] = await db.query(`SELECT role FROM users WHERE id = ?`, [nextInLine.user_id]);
      const activeCount = await reservationModel.countActiveInWeek(nextInLine.user_id, cancelled.date);

      if (user?.role !== 'admin' && activeCount >= WEEKLY_CAP) {
        await waitlistModel.updateStatus(nextInLine.id, 'expired');
        continue;
      }

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
      return;
    }
  } catch (err) {
    console.error('Waitlist auto-fill error:', err);
  }
});