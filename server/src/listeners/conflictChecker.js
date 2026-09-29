const eventBus = require('../events/bus');
const reservationModel = require('../models/reservationModel');

eventBus.on('reservation.requested', async (reservation) => {
  const overlaps = await reservationModel.findOverlapping(reservation);
  // overlaps will include the reservation itself, so more than 1 means a real conflict
  if (overlaps.length > 1) {
    await reservationModel.updateStatus(reservation.id, 'rejected');
    eventBus.emit('reservation.rejected', reservation);
  } else {
    eventBus.emit('reservation.validated', reservation);
  }
});
