const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const userModel = require('../models/userModel');
const db = require('../config/db');
const { requireAuth } = require('../middleware/authMiddleware');
const { sendResetEmail, sendVerificationEmail } = require('../utils/mailer');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../config/s3');

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    key: (req, file, cb) => {
      cb(null, `avatars/${req.user.id}-${Date.now()}-${file.originalname}`);
    },
  }),
});

// POST /api/auth/send-verification - step 1 of registration
router.post('/send-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const existing = await userModel.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(`INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)`, [email, code, expires]);
    await sendVerificationEmail(email, code);

    res.json({ message: 'Verification code sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// POST /api/auth/register - now requires a verified code
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, code } = req.body;
    if (!name || !email || !password || !code) {
      return res.status(400).json({ error: 'Name, email, password, and verification code are required' });
    }

    const [codeRows] = await db.query(
      `SELECT * FROM email_verifications WHERE email = ? AND code = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );
    if (codeRows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    const existing = await userModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userModel.createUser({ name, email, passwordHash });

    await db.query(`UPDATE users SET email_verified = TRUE WHERE id = ?`, [user.id]);
    await db.query(`DELETE FROM email_verifications WHERE email = ?`, [email]);

    res.status(201).json({ message: 'Account created', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findByEmail(email);

console.log('LOGIN DEBUG:', {
  email,
  userFound: !!user,
  userId: user?.id,
  role: user?.role,
  hasPasswordHash: !!user?.password_hash,
});

if (!user) return res.status(401).json({ error: 'Invalid email or password' });

const passwordMatches = await bcrypt.compare(password, user.password_hash);

console.log('PASSWORD MATCH:', passwordMatches);

if (!passwordMatches) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const updated = await userModel.updateProfile(req.user.id, {
      name: req.body.name,
      avatarUrl: req.body.avatarUrl || null,
    });
    res.json({ user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/auth/profile/avatar - real file upload saved in s3(aws)
router.post('/profile/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const avatarUrl = req.file.location;
    await db.query(`UPDATE users SET avatar_url = ? WHERE id = ?`, [avatarUrl, req.user.id]);

    res.json({ avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await userModel.findByEmail(req.body.email);
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link was sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000);
    await db.query(`UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`, [token, expires, user.id]);

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    await sendResetEmail(user.email, resetLink);

    res.json({ message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const [rows] = await db.query(`SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()`, [token]);
    const user = rows[0];
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?`, [passwordHash, user.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;