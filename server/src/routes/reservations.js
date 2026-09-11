const express = require('express');
const router = express.Router();
const eventBus = require('../events/bus');
const reservationModel = require('../models/reservationModel');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');


// POST /api/reservations - resident submits a reservation request
router.post('/', requireAuth, async (req, res) => {
  try {
    const reservation = await reservationModel.createReservation({
      userId: req.user.id, 
      courtId: req.body.courtId,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
    });
    eventBus.emit('reservation.requested', reservation);
    res.status(201).json(reservation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// POST /api/reservations/:id/approve - admin approves
router.post('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
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
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    const [rows] = await db.query(`SELECT * FROM reservations WHERE id = ?`, [req.params.id]);
    const reservation = rows[0];

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const isOwner = reservation.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only cancel your own reservations' });
    }

    await reservationModel.updateStatus(req.params.id, 'cancelled');
    eventBus.emit('reservation.cancelled', { id: req.params.id });
    res.json({ status: 'cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
});

// GET /api/reservations - residents see their own, admins see everyone's
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = require('../config/db');
    let rows;
    if (req.user.role === 'admin') {
      [rows] = await db.query(`SELECT * FROM reservations ORDER BY created_at DESC`);
    } else {
      [rows] = await db.query(
        `SELECT * FROM reservations WHERE user_id = ? ORDER BY created_at DESC`,
        [req.user.id]
      );
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// POST /api/reservations/:id/reject - admin manually rejects (separate from auto-reject via conflict check)
router.post('/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    await reservationModel.updateStatus(req.params.id, 'rejected');
    eventBus.emit('reservation.rejected', { id: req.params.id });
    res.json({ status: 'rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject reservation' });
  }
});

module.exports = router;
