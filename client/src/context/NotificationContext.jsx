import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';


const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [liveStats, setLiveStats] = useState({ activeNow: 0 });
  const socketRef = useRef(null);
  

  function connect() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (!token || !user.id) return;

    const socket = io(import.meta.env.VITE_API_URL);
    socketRef.current = socket;

    socket.on('liveStats', (data) => setLiveStats(data));

    socket.on('connect', () => {
      socket.emit('identify', { userId: user.id, role: user.role });
    });

    function addNotification(message) {
      setNotifications((prev) =>
        [{ id: Date.now(), message, read: false, createdAt: new Date().toISOString() }, ...prev].slice(0, 20)
      );
    }

      socket.on('newReservation', (reservation) => {
        addNotification(`New booking request from ${reservation.userName} (ID #${reservation.userId})`);
      });

    socket.on('statusUpdate', (data) => {
      addNotification(`Your reservation #${data.id} was ${data.status}`);
    });

    socket.on('waitlistOffer', (data) => {
      addNotification(data.message || 'A waitlisted slot is now available!');
    });
    
  }

  useEffect(() => {
    connect();
    window.addEventListener('auth-change', connect);
    return () => {
      window.removeEventListener('auth-change', connect);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

      return (
      <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, liveStats }}>
        {children}
      </NotificationContext.Provider>
    );
}

export function useNotifications() {
  return useContext(NotificationContext);
}