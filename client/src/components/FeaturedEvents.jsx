import { useState, useEffect } from 'react';
import { CalendarDays, Users } from 'lucide-react';
import { io } from 'socket.io-client';

function formatTime12Hour(timeString) {
  const [hourStr, minute] = timeString.split(':');
  const hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute} ${period}`;
}

function FeaturedEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchPublicEvents() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/reservations/public`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to load events');

      const data = await response.json();
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPublicEvents();
  }, []);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL);
    socket.on('publicEventPosted', fetchPublicEvents);
    return () => socket.disconnect();
  }, []);

  // Styled for the dark sidebar and mobile menu (white text on the slate background)
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3 px-1">
        Featured Reservations
      </h3>

      {loading ? (
        <p className="text-xs text-white/50 px-1">Loading...</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-white/50 px-1">
          No public events yet. Mark a booking as "Public" to show it here.
        </p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-sm font-medium text-white truncate">
                {event.event_title || `${event.user_name}'s Game`}
              </p>
              <p className="text-xs text-orange-400 mt-0.5">{event.court_name}</p>
              {event.event_description && (
                <p className="text-xs text-white/60 mt-1 line-clamp-2">{event.event_description}</p>
              )}
              <p className="flex items-center gap-1.5 text-xs text-white/60 mt-2">
                <CalendarDays className="h-3 w-3 shrink-0" />
                {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                {formatTime12Hour(event.start_time)}
                {event.end_time ? ` - ${formatTime12Hour(event.end_time)}` : ''}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-white/60 mt-1">
                <Users className="h-3 w-3 shrink-0" />
                <span className="truncate">Hosted by {event.user_name}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FeaturedEvents;