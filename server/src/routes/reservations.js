const express = require('express');
const router = express.Router();
const eventBus = require('../events/bus');
const reservationModel = require('../models/reservationModel');

// POST /api/reservations - resident submits a reservation request
router.post('/', async (req, res) => {
  try {
    const reservation = await reservationModel.createReservation(req.body);
    eventBus.emit('reservation.requested', reservation);
    res.status(201).json(reservation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// POST /api/reservations/:id/approve - admin approves
router.post('/:id/approve', async (req, res) => {
  try {
    await reservationModel.updateStatus(req.params.id, 'approved');
    eventBus.emit('reservation.approved', { id: req.params.id });
    res.json({ status: 'approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve reservation' });
  }
});

// POST /api/reservations/:id/cancel
router.post('/:id/cancel', async (req, res) => {
  try {
    await reservationModel.updateStatus(req.params.id, 'cancelled');
    eventBus.emit('reservation.cancelled', { id: req.params.id });
    res.json({ status: 'cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
});

module.exports = router;
