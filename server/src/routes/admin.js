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

module.exports = router;