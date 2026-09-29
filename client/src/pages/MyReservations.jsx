import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Plus, Calendar, Clock, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 10;

function formatDateDisplay(dateString) {
  const cleanDate = dateString.split('T')[0];
  const [year, month, day] = cleanDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime12Hour(timeString) {
  const [hourStr, minute] = timeString.split(':');
  const hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute} ${period}`;
}

function statusBadge(status) {
  const map = {
    approved: { label: 'Approved', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
    pending: { label: 'Pending', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
    cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 hover:bg-slate-100' },
    waiting: { label: 'Waitlist', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
    offered: { label: 'Offered', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  };
  const entry = map[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
  return <Badge className={entry.className}>{entry.label}</Badge>;
}

function MyReservations() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  async function fetchAll() {
    try {
      const token = localStorage.getItem('token');
      const [reservationsRes, waitlistRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/reservations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${import.meta.env.VITE_API_URL}/api/waitlist`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!reservationsRes.ok || !waitlistRes.ok) {
        throw new Error('Failed to load reservations');
      }

      setReservations(await reservationsRes.json());
      setWaitlist(await waitlistRes.json());
    } catch (err) {
      console.error(err);
      setError('Could not load your reservations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    setCurrentPage(1); // reset to page 1 whenever the tab or search changes
  }, [activeTab, searchTerm]);

  async function handleCancelReservation(id) {
    const confirmed = window.confirm('Cancel this reservation?');
    if (!confirmed) return;

    setActioningId(id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/reservations/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to cancel');
        return;
      }
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert('Something went wrong.');
    } finally {
      setActioningId(null);
    }
  }

  async function handleLeaveWaitlist(id) {
    const confirmed = window.confirm('Leave this waitlist?');
    if (!confirmed) return;

    setActioningId(id);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/waitlist/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to leave waitlist');
        return;
      }
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert('Something went wrong.');
    } finally {
      setActioningId(null);
    }
  }

  const combined = [
    ...reservations.map((r) => ({
      type: 'reservation',
      id: r.id,
      courtId: r.court_id,
      courtName: r.court_name,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status,
    })),
    ...waitlist
      .filter((w) => w.status === 'waiting' || w.status === 'offered')
      .map((w) => ({
        type: 'waitlist',
        id: w.id,
        courtId: w.court_id,
        courtName: w.court_name,
        date: w.date,
        startTime: w.start_time,
        endTime: w.end_time,
        status: w.status,
        position: w.position,
      })),
  ];

  const today = new Date().toISOString().split('T')[0];

  const filtered = combined.filter((item) => {
    const matchesSearch =
      searchTerm === '' ||
      `#${item.id}`.includes(searchTerm) ||
      item.courtName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'approved') return item.status === 'approved';
    if (activeTab === 'waitlist') return item.type === 'waitlist';
    if (activeTab === 'past') return item.date.split('T')[0] < today;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading your reservations...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'approved', label: 'Approved' },
    { key: 'waitlist', label: 'Waitlist' },
    { key: 'past', label: 'Past' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">MY RESERVATIONS</h1>
        </div>
        <Button onClick={() => navigate('/courts')}>
          <Plus className="h-4 w-4" /> New Booking
        </Button>
      </div>

      <div className="flex items-center justify-between bg-slate-100 rounded-lg p-1 gap-2">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white shadow font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative pr-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search IDs or courts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 w-56 bg-white text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b text-left text-xs uppercase text-muted-foreground">
              <th className="p-4 font-medium">Booking ID</th>
              <th className="p-4 font-medium">Court & Location</th>
              <th className="p-4 font-medium">Schedule</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No reservations found.
                </td>
              </tr>
            ) : (
              paginated.map((item) => (
                <tr key={`${item.type}-${item.id}`} className="border-b last:border-0">
                  <td className="p-4">
                    <p className="font-semibold">#{item.id}</p>
                    <p className="text-xs text-muted-foreground">
                      Ref: {item.type === 'waitlist' ? 'WL' : 'RES'}-{item.id}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium">{item.courtName}</p>
                  </td>
                  <td className="p-4">
                    <p className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-orange-500" />
                      {formatDateDisplay(item.date)}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime12Hour(item.startTime)} - {formatTime12Hour(item.endTime)}
                    </p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {statusBadge(item.status)}
                      {item.type === 'waitlist' && item.position && (
                        <Badge variant="outline" className="rounded-full text-xs">
                          #{item.position} in line
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {item.type === 'reservation' &&
                          (item.status === 'pending' || item.status === 'approved') && (
                            <DropdownMenuItem
                              onClick={() => handleCancelReservation(item.id)}
                              disabled={actioningId === item.id}
                            >
                              Cancel Reservation
                            </DropdownMenuItem>
                          )}
                        {item.type === 'waitlist' && item.status === 'waiting' && (
                          <DropdownMenuItem
                            onClick={() => handleLeaveWaitlist(item.id)}
                            disabled={actioningId === item.id}
                          >
                            Leave Waitlist
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
          <p>
            Showing {paginated.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}-
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyReservations;