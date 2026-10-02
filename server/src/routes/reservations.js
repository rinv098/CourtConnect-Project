const express = require('express');
const router = express.Router();
const eventBus = require('../events/bus');
const reservationModel = require('../models/reservationModel');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const db = require('../config/db');
const { isValidCategory } = require('../constants/categories');
const { WEEKLY_CAP } = require('../constants/limits');
const { todayInManila, manilaDateTime } = require('../utils/time');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const withSeconds = (t) => (t.length === 5 ? `${t}:00` : t);

// POST /api/reservations - resident submits a reservation request
router.post('/', requireAuth, async (req, res) => {
  try {
    const initialStatus = req.user.role === 'admin' ? 'approved' : 'pending';

    if (!isValidCategory(req.body.category, req.body.subCategory)) {
      return res.status(400).json({ error: 'Please choose a valid activity category.' });
    }

    const { courtId, date, startTime, endTime } = req.body;
    if (!courtId || !DATE_RE.test(date || '') || !TIME_RE.test(startTime || '') || !TIME_RE.test(endTime || '')) {
      return res.status(400).json({ error: 'Court, date, start time, and end time are required' });
    }

    if (withSeconds(endTime) <= withSeconds(startTime)) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    if (date < todayInManila()) {
      return res.status(400).json({ error: 'Cannot book a date in the past' });
    }

    if (manilaDateTime(date, startTime) <= new Date()) {
      return res.status(400).json({ error: 'Cannot book a time slot that has already passed' });
    }

    const [[court]] = await db.query(`SELECT status FROM courts WHERE id = ?`, [courtId]);
    if (!court) {
      return res.status(404).json({ error: 'Court not found' });
    }

    if (court.status !== 'available') {
      return res.status(400).json({ error: 'This court is currently unavailable' });
    }

    if (req.user.role !== 'admin') {
      const activeCount = await reservationModel.countActiveInWeek(req.user.id, date);
      if (activeCount >= WEEKLY_CAP) {
        return res.status(400).json({ error: `You've reached your limit of ${WEEKLY_CAP} reservations this week.` });
      }
    }

    const reservation = await reservationModel.createReservation({
      userId: req.user.id,
      name: req.user.name,
      courtId,
      date,
      startTime,
      endTime,
      status: initialStatus,
      isPublic: req.body.isPublic || false,
      eventTitle: req.body.eventTitle || null,
      eventDescription: req.body.eventDescription || null,
      category: req.body.category,
      subCategory: req.body.subCategory,
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
    const [rows] = await db.query(`SELECT user_id, status FROM reservations WHERE id = ?`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reservation not found' });

    if (rows[0].status !== 'pending') {
      return res.status(400).json({ error: `Only pending reservations can be approved (this one is ${rows[0].status})` });
    }

    await reservationModel.updateStatus(req.params.id, 'approved');
    eventBus.emit('reservation.approved', { id: req.params.id, userId: rows[0].user_id });
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

    if (!['pending', 'approved'].includes(reservation.status)) {
      return res.status(400).json({ error: `This reservation is already ${reservation.status}` });
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
    const [rows] = await db.query(`SELECT user_id FROM reservations WHERE id = ?`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reservation not found' });

    await reservationModel.updateStatus(req.params.id, 'rejected');
    eventBus.emit('reservation.rejected', { id: req.params.id, userId: rows[0].user_id });
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

    const startDateTime = manilaDateTime(reservation.date, reservation.start_time);
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