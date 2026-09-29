const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.get('/', requireAuth, async (req, res) => {
  try {
    const [courts] = await db.query(`SELECT * FROM courts`);
    res.json(courts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch courts' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, location } = req.body;
    const [result] = await db.query(
      `INSERT INTO courts (name, location, status) VALUES (?, ?, 'available')`,
      [name, location]
    );
    res.status(201).json({ id: result.insertId, name, location, status: 'available' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create court' });
  }
});

router.patch('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['available', 'unavailable'].includes(status)) {
      return res.status(400).json({ error: 'Status must be available or unavailable' });
    }
    await db.query(`UPDATE courts SET status = ? WHERE id = ?`, [status, req.params.id]);
    res.json({ status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update court status' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [[{ count }]] = await db.query(
      `SELECT COUNT(*) AS count FROM reservations WHERE court_id = ? AND status IN ('pending','approved')`,
      [req.params.id]
    );
    if (count > 0) {
      return res.status(400).json({ error: 'Cannot delete a court with active reservations. Mark it unavailable instead.' });
    }
    await db.query(`DELETE FROM courts WHERE id = ?`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete court' });
  }
});

module.exports = router;