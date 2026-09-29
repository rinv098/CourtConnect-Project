require('dotenv').config();
const { getIO } = require('./sockets');
const express = require('express');
const cors = require('cors');
const http = require('http');
const authRoutes = require('./routes/auth');
const courtRoutes = require('./routes/courts');

const { initSocket } = require('./sockets');
const reservationRoutes = require('./routes/reservations');
const waitlistRoutes = require('./routes/waitlist');
const adminRoutes = require('./routes/admin');
const adminModel = require('./models/adminModel');

require('./listeners/conflictChecker');
require('./listeners/auditLogger');
require('./listeners/notifier');
require('./listeners/waitlistAutoFill');
require('./listeners/scheduleBroadcaster');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.use('/api/reservations', reservationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/admin', adminRoutes);



app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const server = http.createServer(app);

app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
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
