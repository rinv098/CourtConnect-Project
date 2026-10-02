const eventBus = require('../events/bus');
const reservationModel = require('../models/reservationModel');

eventBus.on('reservation.requested', async (reservation) => {
  try {
    // First come, first served: only a reservation created earlier (lower id) can block this one.
    // Comparing ids also settles simultaneous requests, so exactly one of them survives.
    const earlier = await reservationModel.findEarlierOverlapping(reservation);
    if (earlier.length > 0) {
      await reservationModel.updateStatus(reservation.id, 'rejected');
      eventBus.emit('reservation.rejected', reservation);
    } else {
      eventBus.emit('reservation.validated', reservation);
    }
  } catch (err) {
    console.error('Conflict check failed:', err);
  }
});