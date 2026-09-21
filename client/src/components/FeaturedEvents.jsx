import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base">Featured Reservation</h3>
          <span className="text-xs text-muted-foreground">Public bookings</span>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No public events posted yet. Mark your next booking as "Public" to advertise it here.
          </p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">
                      {event.event_title || `${event.user_name}'s Game`}
                    </p>
                    {event.event_description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {event.event_description}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {event.court_name}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {formatTime12Hour(event.start_time)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Hosted by {event.user_name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FeaturedEvents;