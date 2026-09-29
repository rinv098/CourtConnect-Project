const eventBus = require('../events/bus');
const db = require('../config/db');

const EVENTS_TO_LOG = [
  'reservation.requested',
  'reservation.validated',
  'reservation.rejected',
  'reservation.approved',
  'reservation.cancelled',
];

EVENTS_TO_LOG.forEach((eventName) => {
  eventBus.on(eventName, async (payload) => {
    try {
      await db.query(
        `INSERT INTO audit_log (event_type, payload_json, created_at) VALUES (?, ?, NOW())`,
        [eventName, JSON.stringify(payload)]
      );
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  });
});
