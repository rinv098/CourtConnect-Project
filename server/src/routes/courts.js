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

module.exports = router;