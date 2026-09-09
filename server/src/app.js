require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

const { initSocket } = require('./sockets');
const reservationRoutes = require('./routes/reservations');

// Registering listener files makes them start listening on the shared event bus.
// They don't export anything to call directly - just importing them wires them up.
require('./listeners/conflictChecker');
require('./listeners/auditLogger');
require('./listeners/notifier');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.use('/api/reservations', reservationRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`CourtConnect server running on port ${PORT}`));
