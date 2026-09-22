const eventBus = require('../events/bus');
const { getIO } = require('../sockets');


const GRID_EVENTS = [
  'reservation.requested',
  'reservation.approved',
  'reservation.rejected',
  'reservation.cancelled',
];

GRID_EVENTS.forEach((eventName) => {
  eventBus.on(eventName, () => {
    try {
      getIO().emit('scheduleChanged');
    } catch (err) {
      console.error('scheduleChanged broadcast failed:', err.message);
    }
  });
});