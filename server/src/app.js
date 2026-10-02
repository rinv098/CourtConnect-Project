require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const courtRoutes = require('./routes/courts');
const reservationRoutes = require('./routes/reservations');
const waitlistRoutes = require('./routes/waitlist');
const adminRoutes = require('./routes/admin');
const adminModel = require('./models/adminModel');
const { initSocket, getIO } = require('./sockets');

require('./listeners/conflictChecker');
require('./listeners/auditLogger');
require('./listeners/notifier');
require('./listeners/waitlistAutoFill');
require('./listeners/scheduleBroadcaster');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to server/.env before starting.');
  process.exit(1);
}

const app = express();

// Behind a reverse proxy (Render, Railway, nginx), set TRUST_PROXY=1 so rate limits use the real client IP
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

// Security middleware must come BEFORE the routes, otherwise it never runs for them
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

const windowMs = 15 * 60 * 1000;
app.use('/api', rateLimit({ windowMs, max: 500, standardHeaders: true, legacyHeaders: false }));
// Stricter cap on login, verification codes, and password resets to slow down guessing
app.use('/api/auth', rateLimit({ windowMs, max: 30, standardHeaders: true, legacyHeaders: false }));

app.use('/api/reservations', reservationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
initSocket(server);

setInterval(async () => {
  try {
    const count = await adminModel.getLiveNowCount();
    getIO().to('admins').emit('liveStats', { activeNow: count });
  } catch (err) {
    console.error('Live stats push failed:', err);
  }
}, 30000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`CourtConnect server running on port ${PORT}`));