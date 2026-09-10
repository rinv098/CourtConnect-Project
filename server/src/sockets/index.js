let io = null;

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Client tells us who it is so we can target notifications later,
    // e.g. socket.emit('identify', { userId, role })
    socket.on('identify', ({ userId, role }) => {
      socket.join(role === 'admin' ? 'admins' : `user:${userId}`);
    });

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
