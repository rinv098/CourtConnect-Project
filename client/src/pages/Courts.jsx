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
import DateNavigator from '@/components/DateNavigator';
import { CATEGORIES } from '@/lib/categories';
import { Trophy, Info, CheckCircle2, Clock } from 'lucide-react';

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
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [successInfo, setSuccessInfo] = useState(null); // { type, status, courtName, date, start, end, activity }

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

    socket.on('connect', () => {
      console.log('[Courts] socket connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('[Courts] socket connect_error:', err.message);
    });

    socket.on('scheduleChanged', () => {
      console.log('[Courts] scheduleChanged received, refetching', selectedDateRef.current);
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
    setCategory('');
    setSubCategory('');
  }

  function courtNameFor(courtId) {
    return courts.find((c) => c.id === courtId)?.name || 'Court';
  }

  async function handleBookingSubmit(e) {
    e.preventDefault();
    setSubmitMessage('');

    if (!category || !subCategory) {
      setSubmitMessage('Please choose what the court will be used for.');
      return;
    }

    setSubmitting(true);

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
          category,
          subCategory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitMessage(data.error || 'Booking failed');
        return;
      }

      setSuccessInfo({
        type: 'booking',
        status: data.status,
        courtName: courtNameFor(modalSlot.courtId),
        date: selectedDate,
        start: modalSlot.start,
        end: modalSlot.end,
        activity: subCategory,
      });
      setModalSlot(null);
      await fetchSchedule(selectedDate);
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

      setSuccessInfo({
        type: 'waitlist',
        courtName: courtNameFor(modalSlot.courtId),
        date: selectedDate,
        start: modalSlot.start,
        end: modalSlot.end,
      });
      setModalSlot(null);
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

      {/* Date navigation */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-1">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Reservations Schedule
          </h2>
          <DateNavigator value={selectedDate} onChange={setSelectedDate} min={TODAY} />
        </CardContent>
      </Card>

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
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                  {submitMessage && <p className="text-sm text-red-500">{submitMessage}</p>}
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleJoinWaitlist} disabled={submitting}>
                      {submitting ? 'Joining...' : 'Join Waitlist'}
                    </Button>
                    <Button variant="outline" onClick={() => setModalSlot(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">What is the court for?</Label>

                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(CATEGORIES).map(([key, group]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setCategory(key);
                            setSubCategory('');
                          }}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            category === key
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {group.label}
                        </button>
                      ))}
                    </div>

                    {category && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {CATEGORIES[category].options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSubCategory(option)}
                            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                              subCategory === option
                                ? 'border-orange-500 bg-orange-500 text-white'
                                : 'border-slate-200 hover:bg-orange-50'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

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

                  {submitMessage && <p className="text-sm text-red-500">{submitMessage}</p>}

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

      {/* Success popup */}
      {successInfo && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSuccessInfo(null)}
        >
          <Card
            className="w-full max-w-sm animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6 text-center space-y-4">
              <div
                className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                  successInfo.type === 'waitlist' || successInfo.status === 'pending'
                    ? 'bg-orange-100 text-orange-500'
                    : 'bg-green-100 text-green-600'
                }`}
              >
                {successInfo.type === 'waitlist' || successInfo.status === 'pending' ? (
                  <Clock className="h-8 w-8" />
                ) : (
                  <CheckCircle2 className="h-8 w-8" />
                )}
              </div>

              <div>
                <h3 className="text-xl font-bold">
                  {successInfo.type === 'waitlist'
                    ? "You're on the waitlist!"
                    : successInfo.status === 'approved'
                    ? 'Reservation confirmed!'
                    : 'Reservation submitted!'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {successInfo.type === 'waitlist'
                    ? "We'll notify you if this slot opens up."
                    : successInfo.status === 'approved'
                    ? 'Your court is booked. See you there!'
                    : 'Waiting for admin approval. You can track it in My Reservations.'}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-sm text-left space-y-1">
                <p className="font-medium">{successInfo.courtName}</p>
                <p className="text-muted-foreground">
                  {formatDateDisplay(successInfo.date)} · {formatHour(parseInt(successInfo.start))} - {formatHour(parseInt(successInfo.end))}
                </p>
                {successInfo.activity && (
                  <p className="text-muted-foreground">Activity: {successInfo.activity}</p>
                )}
              </div>

              <Button className="w-full" onClick={() => setSuccessInfo(null)}>
                Done
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Courts;