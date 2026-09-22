import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FeaturedEvents from '@/components/FeaturedEvents';
import { Trophy, Info } from 'lucide-react';

function generateTimeSlots() {
  const slots = [];
  for (let hour = 8; hour <= 21; hour++) {
    slots.push({
      start: `${hour.toString().padStart(2, '0')}:00`,
      end: `${(hour + 1).toString().padStart(2, '0')}:00`,
      label: formatHour(hour),
    });
  }
  return slots;
}

function formatHour(hour) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${displayHour.toString().padStart(2, '0')}:00 ${period}`;
}

function getTodayDateString() {
  const today = new Date();
  return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
}

function isSlotInPast(date, slotStart) {
  if (date !== TODAY) return false; // only matters for today
  const now = new Date();
  const [hour, minute] = slotStart.split(':').map(Number);
  const slotTime = new Date();
  slotTime.setHours(hour, minute, 0, 0);
  return slotTime <= now;
}

function formatDateDisplay(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const TIME_SLOTS = generateTimeSlots();
const TODAY = getTodayDateString();

function Courts() {
  const [courts, setCourts] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalSlot, setModalSlot] = useState(null); // { courtId, start, end, taken }
  const [isPublic, setIsPublic] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function fetchCourts() {
    const token = localStorage.getItem('token');
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/courts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setCourts(data);
  }

  async function fetchSchedule(date) {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/reservations/schedule?date=${date}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    setSchedule(data);
  }

  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true);
        await fetchCourts();
        await fetchSchedule(selectedDate);
      } catch (err) {
        console.error(err);
        setError('Could not load courts or schedule. Is the server running?');
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [selectedDate]);

  // Keep a ref of the currently viewed date so the socket handler below always
  // refetches the right day, without needing to reconnect on every date change.
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // Live grid updates: any booking, approval, rejection, or cancellation anywhere
  // in the app triggers a scheduleChanged broadcast, so refetch when we hear one.
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL);
    socket.on('scheduleChanged', () => {
      fetchSchedule(selectedDateRef.current);
    });
    return () => socket.disconnect();
  }, []);

  function findBooking(courtId, slotStart) {
    return schedule.find((r) => r.courtId === courtId && r.startTime.slice(0, 5) === slotStart);
  }

  function openModal(courtId, slot) {
    const existing = findBooking(courtId, slot.start);
    setModalSlot({ courtId, start: slot.start, end: slot.end, taken: !!existing });
    setIsPublic(false);
    setEventTitle('');
    setEventDescription('');
    setSubmitMessage('');
  }

  async function handleBookingSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          courtId: modalSlot.courtId,
          date: selectedDate,
          startTime: modalSlot.start,
          endTime: modalSlot.end,
          isPublic,
          eventTitle: isPublic ? eventTitle : null,
          eventDescription: isPublic ? eventDescription : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitMessage(data.error || 'Booking failed');
        return;
      }

      setSubmitMessage(`Book status: ${data.status}`);
      await fetchSchedule(selectedDate);
      setTimeout(() => setModalSlot(null), 1200);
    } catch (err) {
      console.error(err);
      setSubmitMessage('Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoinWaitlist() {
    setSubmitting(true);
    setSubmitMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          courtId: modalSlot.courtId,
          date: selectedDate,
          startTime: modalSlot.start,
          endTime: modalSlot.end,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitMessage(data.error || 'Failed to join waitlist');
        return;
      }

      setSubmitMessage('Added to waitlist! you\'ll be notified if this slot opens up.');
      setTimeout(() => setModalSlot(null), 1500);
    } catch (err) {
      console.error(err);
      setSubmitMessage('Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero banner */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 text-white p-8">
        <div className="relative z-10 max-w-xl">
          <p className="flex items-center gap-2 text-orange-400 text-sm font-semibold mb-2">
            <Trophy className="h-4 w-4" /> BARANGAY COURTS
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">SAN JUAN COURTS</h1>
          <p className="text-white/70 text-sm">
            Pick a court, grab an open slot, and play. Taken already? Hop on the waitlist and
            we'll let you know the second it opens up.
          </p>
        </div>
      </div>

      {/* Featured events */}
      <FeaturedEvents />

      {/* Date picker */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Reservations Schedule</h2>
        <Input
          type="date"
          min={TODAY}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-44"
        />
      </div>
        {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-primary/90" /> Confirmed</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300" /> Pending</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-50 border border-dashed" /> Available</span>
      </div>

      {/* Schedule grid */}
      <Card className="overflow-x-auto">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left p-3 font-medium text-muted-foreground w-24">Time</th>
                {courts.map((court) => (
                  <th key={court.id} className="text-left p-3 font-medium min-w-[140px]">
                    {court.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot) => (
                <tr key={slot.start} className="border-b last:border-0">
                  <td className="p-3 text-muted-foreground whitespace-nowrap">{slot.label}</td>
                  {courts.map((court) => {
                    const booking = findBooking(court.id, slot.start);
                    const isPast = isSlotInPast(selectedDate, slot.start);
                    return (
                      <td key={court.id} className="p-2">
                        <button
                          onClick={() => !isPast && openModal(court.id, slot)}
                          disabled={isPast}
                          className={`w-full h-14 rounded-lg text-xs px-2 flex flex-col items-start justify-center transition-colors ${
                                isPast
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                                  : !booking
                                  ? 'bg-slate-50 hover:bg-slate-100 border border-dashed'
                                  : booking.status === 'approved'
                                  ? 'bg-primary/90 text-white hover:bg-primary'
                                  : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                              }`}
                        >
                          {isPast ? (
                                <span>Past</span>
                              ) : !booking ? (
                                <span className="text-muted-foreground">Available</span>
                              ) : (
                            <>
                              <span className="font-medium">
                                {booking.status === 'approved' ? 'Confirmed' : 'Pending'}
                              </span>
                              <span className="truncate w-full text-left opacity-90">
                                {booking.label}
                              </span>
                            </>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      

      {/* Booking modal */}
      {modalSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-1">
                {modalSlot.taken ? 'Slot Taken' : 'Confirm Booking'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                  {formatHour(parseInt(modalSlot.start))} - {formatHour(parseInt(modalSlot.end))} · {formatDateDisplay(selectedDate)}
              </p>

              {modalSlot.taken ? (
                <div className="space-y-4">
                  <p className="text-sm flex items-start gap-2 bg-orange-50 text-orange-800 p-3 rounded-lg">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    This slot is already booked. Join the waitlist and we'll notify you if it opens up.
                  </p>
                  {submitMessage && <p className="text-sm text-muted-foreground">{submitMessage}</p>}
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleJoinWaitlist} disabled={submitting}>
                      {submitting ? 'Joining...' : 'Join Waitlist'}
                    </Button>
                    <Button variant="outline" onClick={() => setModalSlot(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Checkbox id="isPublic" checked={isPublic} onCheckedChange={setIsPublic} />
                    <Label htmlFor="isPublic" className="font-normal">
                      Make this a public event (visible to other residents)
                    </Label>
                  </div>

                  {isPublic && (
                    <div className="space-y-3 bg-slate-50 p-3 rounded-lg">
                      <div className="space-y-1">
                        <Label htmlFor="eventTitle" className="text-xs">Event Title</Label>
                        <Input
                          id="eventTitle"
                          value={eventTitle}
                          onChange={(e) => setEventTitle(e.target.value)}
                          placeholder="e.g. 3v3 Pickup Game"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="eventDescription" className="text-xs">Description (optional)</Label>
                        <Input
                          id="eventDescription"
                          value={eventDescription}
                          onChange={(e) => setEventDescription(e.target.value)}
                          placeholder=""
                        />
                      </div>
                    </div>
                  )}

                  {submitMessage && <p className="text-sm text-muted-foreground">{submitMessage}</p>}

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={submitting}>
                      {submitting ? 'Booking...' : 'Confirm Booking'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setModalSlot(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Courts;