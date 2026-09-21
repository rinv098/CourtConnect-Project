const express = require('express');
const router = express.Router();
const waitlistModel = require('../models/waitlistModel');
const { requireAuth } = require('../middleware/authMiddleware');
const db = require('../config/db');

// POST /api/waitlist - join the waitlist for a full slot
router.post('/', requireAuth, async (req, res) => {
  try {
    const [[existing]] = await db.query(
      `SELECT COUNT(*) AS count FROM reservations WHERE user_id = ? AND court_id = ? AND date = ? AND start_time = ? AND status IN ('pending','approved')`,
      [req.user.id, req.body.courtId, req.body.date, req.body.startTime]
    );

    if (existing.count > 0) {
      return res.status(400).json({ error: 'You already have this slot reserved' });
    }

    const entry = await waitlistModel.joinWaitlist({
      userId: req.user.id,
      courtId: req.body.courtId,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
    });
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join waitlist' });
  }
});

// GET /api/waitlist - residents see their own, admins see everyone's
router.get('/', requireAuth, async (req, res) => {
  try {
    const entries =
      req.user.role === 'admin'
        ? await waitlistModel.findAll()
        : await waitlistModel.findByUser(req.user.id);

    const withPositions = await Promise.all(
      entries.map(async (e) => ({
        ...e,
        position: await waitlistModel.getPosition(e.id),
      }))
    );

    res.json(withPositions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch waitlist' });
  }
});

// DELETE /api/waitlist/:id - leave the waitlist
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM waitlist WHERE id = ?`, [req.params.id]);
    const entry = rows[0];

    if (!entry) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }

    const isOwner = entry.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only leave your own waitlist entry' });
    }

    await waitlistModel.updateStatus(req.params.id, 'cancelled');
    res.json({ status: 'cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to leave waitlist' });
  }
});

module.exports = router;