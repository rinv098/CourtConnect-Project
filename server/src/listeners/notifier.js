const eventBus = require('../events/bus');
const { getIO } = require('../sockets');

eventBus.on('reservation.validated', (reservation) => {
  getIO().to('admins').emit('newReservation', reservation);
});

eventBus.on('reservation.approved', (reservation) => {
  getIO().to(`user:${reservation.userId}`).emit('statusUpdate', {
    id: reservation.id,
    status: 'approved',
  });
});

eventBus.on('reservation.rejected', (reservation) => {
  getIO().to(`user:${reservation.userId}`).emit('statusUpdate', {
    id: reservation.id,
    status: 'rejected',
  });
});
