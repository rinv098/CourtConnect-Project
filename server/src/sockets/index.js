const jwt = require('jsonwebtoken');

let io = null;

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL, methods: ['GET', 'POST'] },
  });

  // Identity comes from a verified JWT, never from something the client claims.
  // No or invalid token = anonymous connection: it still gets public broadcasts
  // (scheduleChanged, publicEventPosted) but joins no private room.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        socket.user = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        // expired or forged token, fall through as anonymous
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    if (socket.user) {
      socket.join(socket.user.role === 'admin' ? 'admins' : `user:${socket.user.id}`);
    }

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized yet');
  return io;
}

module.exports = { initSocket, getIO };