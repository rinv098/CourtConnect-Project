const express = require('express');
const router = express.Router();
const adminModel = require('../models/adminModel');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const stats = await adminModel.getStats();
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/occupancy', requireAuth, requireAdmin, async (req, res) => {
  try {
    const occupancy = await adminModel.getCourtOccupancyToday();
    res.json(occupancy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch occupancy' });
  }
});

router.get('/activity', requireAuth, requireAdmin, async (req, res) => {
  try {
    const activity = await adminModel.getRecentActivity();
    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});
router.get('/audit-log', requireAuth, requireAdmin, async (req, res) => {
  try {
    const log = await adminModel.getFullAuditLog();
    res.json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

router.get('/live-now', requireAuth, requireAdmin, async (req, res) => {
  try {
    const count = await adminModel.getLiveNowCount();
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch live count' });
  }
});

router.get('/trend', requireAuth, requireAdmin, async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days, 10) : 14;
    const trend = await adminModel.getReservationTrend(days);
    res.json(trend);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trend' });
  }
});

router.get('/trend/year', requireAuth, requireAdmin, async (req, res) => {
  try {
    const year = req.query.year
      ? parseInt(req.query.year, 10)
      : new Date().getFullYear();
    const trend = await adminModel.getReservationsByMonth(year);
    res.json(trend);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch yearly trend' });
  }
});

router.get('/trend/month', requireAuth, requireAdmin, async (req, res) => {
  try {
    const year = req.query.year
      ? parseInt(req.query.year, 10)
      : new Date().getFullYear();
    const month = req.query.month
      ? parseInt(req.query.month, 10)
      : new Date().getMonth() + 1;
    const trend = await adminModel.getReservationsByDayOfMonth(year, month);
    res.json(trend);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch monthly trend' });
  }
});

router.get('/trend/day', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    const records = await adminModel.getReservationsForDate(date);
    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch day records' });
  }
});

module.exports = router;