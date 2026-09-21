const express = require('express');
const router = express.Router();
const eventBus = require('../events/bus');
const reservationModel = require('../models/reservationModel');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const db = require('../config/db');

// POST /api/reservations - resident submits a reservation request
router.post('/', requireAuth, async (req, res) => {
  try {
    const initialStatus = req.user.role === 'admin' ? 'approved' : 'pending';

    const today = new Date().toISOString().split('T')[0];
    if (req.body.date < today) {
      return res.status(400).json({ error: 'Cannot book a date in the past' });
    }

       const now = new Date();
    const requestedDateTime = new Date(`${req.body.date}T${req.body.startTime}`);
    if (requestedDateTime <= now) {
      return res.status(400).json({ error: 'Cannot book a time slot that has already passed' });
    }

    if (req.user.role !== 'admin') {
      const [[capCheck]] = await db.query(
        `SELECT COUNT(*) AS count FROM reservations
         WHERE user_id = ? AND status IN ('pending','approved')
         AND YEARWEEK(date, 1) = YEARWEEK(?, 1)`,
        [req.user.id, req.body.date]
      );
      const WEEKLY_CAP = 2;
      if (capCheck.count >= WEEKLY_CAP) {
        return res.status(400).json({ error: `You've reached your limit of ${WEEKLY_CAP} reservations this week.` });
      }
    }

    const reservation = await reservationModel.createReservation({
      userId: req.user.id,
      name: req.user.name,
      courtId: req.body.courtId,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      status: initialStatus,
      isPublic: req.body.isPublic || false,
      eventTitle: req.body.eventTitle || null,
      eventDescription: req.body.eventDescription || null,
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

// GET /api/reservations/schedule?date=YYYY-MM-DD - grid occupancy for all courts, privacy-safe
router.get('/schedule', requireAuth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date query parameter is required' });
    }
    const schedule = await reservationModel.findScheduleForDate(date);
    res.json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// GET /api/reservations/public - upcoming public events for the Featured Events widget
router.get('/public', requireAuth, async (req, res) => {
  try {
    const events = await reservationModel.findPublicUpcoming();
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch public events' });
  }
});

// GET /api/reservations - residents see their own, admins see everyone's
router.get('/', requireAuth, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      [rows] = await db.query(
        `SELECT r.*, c.name AS court_name
         FROM reservations r
         JOIN courts c ON r.court_id = c.id
         ORDER BY r.created_at DESC`
      );
    } else {
      [rows] = await db.query(
        `SELECT r.*, c.name AS court_name
         FROM reservations r
         JOIN courts c ON r.court_id = c.id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC`,
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

// GET /api/reservations/manage - admin-only, full detail list for management UI
router.get('/manage', requireAuth, requireAdmin, async (req, res) => {
  try {
    const reservations = await reservationModel.findAllWithDetails();
    res.json(reservations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// POST /api/reservations/:id/checkin - admin marks resident as arrived
router.post('/:id/checkin', requireAuth, requireAdmin, async (req, res) => {
  try {
    await reservationModel.checkIn(req.params.id);
    res.json({ status: 'checked_in' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// POST /api/reservations/:id/no-show - admin marks as no-show, only after 15-min grace period
router.post('/:id/no-show', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM reservations WHERE id = ?`, [req.params.id]);
    const reservation = rows[0];

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    if (reservation.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved reservations can be marked no-show' });
    }
    if (reservation.checked_in) {
      return res.status(400).json({ error: 'This resident already checked in' });
    }

    const dateStr = reservation.date instanceof Date
      ? reservation.date.toISOString().split('T')[0]
      : reservation.date.split('T')[0];
    const startDateTime = new Date(`${dateStr}T${reservation.start_time}`);
    const graceDeadline = new Date(startDateTime.getTime() + 15 * 60 * 1000);

    if (new Date() < graceDeadline) {
      return res.status(400).json({ error: 'Grace period has not elapsed yet (15 minutes after start time)' });
    }

    await reservationModel.markNoShow(req.params.id, reservation.user_id);
    res.json({ status: 'no_show' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark no-show' });
  }
});
module.exports = router;