import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  ClipboardList, TrendingUp, Building2, Plus, Check, X as XIcon, Activity,
  Download, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { useNotifications } from '@/context/NotificationContext';

const PAGE_SIZE = 10;

function formatDateDisplay(dateString) {
  const cleanDate = dateString.split('T')[0];
  const [year, month, day] = cleanDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

function formatTime12Hour(timeString) {
  const [hourStr, minute] = timeString.split(':');
  const hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute} ${period}`;
}

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function activityLabel(eventType) {
  const map = {
    'reservation.requested': 'New reservation requested',
    'reservation.validated': 'Reservation passed conflict check',
    'reservation.approved': 'Reservation approved',
    'reservation.rejected': 'Reservation rejected',
    'reservation.cancelled': 'Reservation cancelled',
  };

  return map[eventType] || eventType;
}

function activityDot(eventType) {
  if (eventType.includes('approved')) return 'bg-green-500';
  if (eventType.includes('rejected') || eventType.includes('cancelled')) return 'bg-red-400';
  return 'bg-orange-400';
}

function isPastGracePeriod(dateString, startTime) {
  const cleanDate = dateString.split('T')[0];
  const start = new Date(`${cleanDate}T${startTime}`);
  const grace = new Date(start.getTime() + 15 * 60 * 1000);

  return new Date() >= grace;
}

/* =========================================================
   DAILY NEW ITEM TRACKING
   ========================================================= */

const DAILY_SEEN_STORAGE_KEY = 'adminDashboardDailySeen';

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function emptyDailySeenState() {
  return {
    date: getLocalDateKey(),
    reservationIds: [],
    waitlistIds: [],
  };
}

function loadDailySeenState() {
  if (typeof window === 'undefined') {
    return emptyDailySeenState();
  }

  try {
    const saved = JSON.parse(
      localStorage.getItem(DAILY_SEEN_STORAGE_KEY) || 'null'
    );

    if (!saved || saved.date !== getLocalDateKey()) {
      return emptyDailySeenState();
    }

    return {
      date: saved.date,
      reservationIds: Array.isArray(saved.reservationIds)
        ? saved.reservationIds
        : [],
      waitlistIds: Array.isArray(saved.waitlistIds)
        ? saved.waitlistIds
        : [],
    };
  } catch {
    return emptyDailySeenState();
  }
}

function saveDailySeenState(state) {
  if (typeof window === 'undefined') return;

  localStorage.setItem(
    DAILY_SEEN_STORAGE_KEY,
    JSON.stringify(state)
  );
}

/* ========================================================= */

function statusBadge(status) {
  const map = {
    approved: 'bg-green-100 text-green-700 hover:bg-green-100',
    pending: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
    rejected: 'bg-red-100 text-red-700 hover:bg-red-100',
    cancelled: 'bg-slate-100 text-slate-500 hover:bg-slate-100',
    no_show: 'bg-red-100 text-red-800 hover:bg-red-100',
    waiting: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
    offered: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  };

  return (
    <Badge
      className={`${map[status] || 'bg-slate-100 text-slate-600'} rounded-full font-medium`}
    >
      {status}
    </Badge>
  );
}

function initials(name) {
  if (!name) return '?';

  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  'bg-orange-500',
  'bg-amber-500',
  'bg-orange-600',
  'bg-amber-600',
  'bg-orange-400',
  'bg-amber-400'
];

function avatarColor(name) {
  const index = (name || '').charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] || AVATAR_COLORS[0];
}

function StatCard({ icon: Icon, label, value, sublabel }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              {label}
            </p>

            <p className="text-3xl font-bold tracking-tight">
              {value}
            </p>

            {sublabel && (
              <p className="text-xs text-muted-foreground mt-1">
                {sublabel}
              </p>
            )}
          </div>

          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-orange-50 text-orange-600">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScalableBarLineChart({ data, onItemClick, xLabel, barColor = '#fed7aa', lineColor = '#f97316' }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No data for this period.
      </p>
    );
  }

  const width = 640;
  const height = 220;
  const padding = { top: 28, right: 10, bottom: 28, left: 28 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const slot = chartW / data.length;
  const barW = Math.min(28, slot * 0.55);
  const labelEvery = Math.max(1, Math.ceil(data.length / 12));

  const xFor = (i) => padding.left + slot * i + slot / 2;
  const yFor = (count) => padding.top + chartH - (count / maxCount) * chartH;

  const linePoints = data.map((d, i) => `${xFor(i)},${yFor(d.count)}`).join(' ');

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  const tooltipX = hovered ? Math.min(Math.max(xFor(hoveredIndex), 40), width - 40) : 0;
  const tooltipY = hovered ? Math.max(yFor(hovered.count) - 14, 14) : 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto overflow-visible"
      role="img"
      aria-label="Reservation trend"
    >
      <defs>
        <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {[0, 0.5, 1].map((t) => (
        <line
          key={t}
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + chartH * t}
          y2={padding.top + chartH * t}
          stroke="#f1f5f9"
          strokeWidth="1"
        />
      ))}

      <polyline
        points={linePoints}
        fill="none"
        stroke={lineColor}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {data.map((d, i) => {
        const isHovered = hoveredIndex === i;
        return (
          <g key={d.key}>
            <rect
              x={xFor(i) - barW / 2}
              y={yFor(d.count)}
              width={barW}
              height={Math.max(0, padding.top + chartH - yFor(d.count))}
              rx="3"
              fill={isHovered ? '#fdba74' : barColor}
              className="transition-colors"
            />

            {/* halo behind the node, only visible while hovered/highlighted */}
            {isHovered && (
              <circle
                cx={xFor(i)}
                cy={yFor(d.count)}
                r="9"
                fill={lineColor}
                opacity="0.25"
              />
            )}

            <circle
              cx={xFor(i)}
              cy={yFor(d.count)}
              r={isHovered ? 5 : 3}
              fill={lineColor}
              filter={isHovered ? 'url(#nodeGlow)' : undefined}
              className="transition-all"
            />

            {/* the node itself is the clickable/hoverable target, sized for easy tapping */}
            <circle
              cx={xFor(i)}
              cy={yFor(d.count)}
              r="14"
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onItemClick && onItemClick(d)}
              className={onItemClick ? 'cursor-pointer' : ''}
            />

            {i % labelEvery === 0 && (
              <text
                x={xFor(i)}
                y={height - 8}
                textAnchor="middle"
                fontSize="10"
                fill={isHovered ? lineColor : '#94a3b8'}
                fontWeight={isHovered ? '600' : '400'}
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}

      {hovered && (
        <g pointerEvents="none">
          <rect
            x={tooltipX - 30}
            y={tooltipY - 20}
            width="60"
            height="20"
            rx="5"
            fill="#1e293b"
          />
          <text
            x={tooltipX}
            y={tooltipY - 6}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#fed7aa"
          >
            {hovered.label}: {hovered.count}
          </text>
        </g>
      )}
    </svg>
  );
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function ReservationDrillDownChart() {
  const [view, setView] = useState('year'); // 'year' | 'month' | 'day'
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(null);

  const [chartData, setChartData] = useState([]);
  const [dayRecords, setDayRecords] = useState([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [chartError, setChartError] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (view === 'year') {
      setLoadingChart(true);
      setChartError('');
      fetch(`${import.meta.env.VITE_API_URL}/api/admin/trend/year?year=${year}`, { headers })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((rows) =>
          setChartData(
            rows.map((r) => ({
              key: r.month,
              count: r.count,
              label: MONTH_NAMES[r.month - 1],
              month: r.month
            }))
          )
        )
        .catch(() => setChartError('Could not load the yearly chart.'))
        .finally(() => setLoadingChart(false));
    }
  }, [view, year]);

  useEffect(() => {
    if (view === 'month') {
      setLoadingChart(true);
      setChartError('');
      fetch(
        `${import.meta.env.VITE_API_URL}/api/admin/trend/month?year=${year}&month=${month}`,
        { headers }
      )
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((rows) =>
          setChartData(
            rows.map((r) => ({
              key: r.day,
              count: r.count,
              label: String(r.day),
              day: r.day
            }))
          )
        )
        .catch(() => setChartError('Could not load the monthly chart.'))
        .finally(() => setLoadingChart(false));
    }
  }, [view, year, month]);

  useEffect(() => {
    if (view === 'day' && selectedDate) {
      setLoadingChart(true);
      setChartError('');
      fetch(`${import.meta.env.VITE_API_URL}/api/admin/trend/day?date=${selectedDate}`, { headers })
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then(setDayRecords)
        .catch(() => setChartError('Could not load that day\'s records.'))
        .finally(() => setLoadingChart(false));
    }
  }, [view, selectedDate]);

  function goToMonth(item) {
    setMonth(item.month);
    setView('month');
  }

  function goToDay(item) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setView('day');
  }

  function backToYear() {
    setView('year');
  }

  function backToMonth() {
    setView('month');
  }

  // Live updates: refetch whatever the current drill-down level is showing
  // whenever any booking, approval, rejection or cancellation happens anywhere.
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL);
    socket.on('scheduleChanged', () => {
      if (view === 'year') {
        fetch(`${import.meta.env.VITE_API_URL}/api/admin/trend/year?year=${year}`, { headers })
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((rows) =>
            setChartData(
              rows.map((r) => ({ key: r.month, count: r.count, label: MONTH_NAMES[r.month - 1], month: r.month }))
            )
          )
          .catch(() => {});
      } else if (view === 'month') {
        fetch(`${import.meta.env.VITE_API_URL}/api/admin/trend/month?year=${year}&month=${month}`, { headers })
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((rows) =>
            setChartData(rows.map((r) => ({ key: r.day, count: r.count, label: String(r.day), day: r.day })))
          )
          .catch(() => {});
      } else if (view === 'day' && selectedDate) {
        fetch(`${import.meta.env.VITE_API_URL}/api/admin/trend/day?date=${selectedDate}`, { headers })
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then(setDayRecords)
          .catch(() => {});
      }
    });
    return () => socket.disconnect();
  }, [view, year, month, selectedDate]);

  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 flex-wrap">

        <button
          onClick={backToYear}
          className={`hover:text-orange-600 ${view === 'year' ? 'font-semibold text-foreground' : ''}`}
        >
          {year}
        </button>

        {view !== 'year' && (
          <>
            <span>/</span>
            <button
              onClick={backToMonth}
              className={`hover:text-orange-600 ${view === 'month' ? 'font-semibold text-foreground' : ''}`}
            >
              {MONTH_NAMES[month - 1]}
            </button>
          </>
        )}

        {view === 'day' && selectedDate && (
          <>
            <span>/</span>
            <span className="font-semibold text-foreground">
              {selectedDate}
            </span>
          </>
        )}

        {view === 'year' && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="hover:text-orange-600"
            >
              ‹
            </button>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="hover:text-orange-600"
            >
              ›
            </button>
          </div>
        )}

      </div>

      {chartError && (
        <p className="text-sm text-red-500 mb-2">{chartError}</p>
      )}

      {loadingChart ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : view === 'day' ? (
        dayRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reservations on this date.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">

            {dayRecords.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 text-sm border rounded-lg px-3 py-2"
              >

                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {r.is_public ? (r.event_title || `${r.user_name}'s Game`) : r.user_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.court_name} &middot; {formatTime12Hour(r.start_time)} - {formatTime12Hour(r.end_time)}
                    {r.sub_category ? ` · ${r.sub_category}` : ''}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className="capitalize shrink-0"
                >
                  {r.status}
                </Badge>

              </div>
            ))}

          </div>
        )
      ) : (
        <>
          <ScalableBarLineChart
            data={chartData}
            onItemClick={view === 'year' ? goToMonth : goToDay}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {view === 'year'
              ? 'Tap a month to see its days.'
              : 'Tap a day to see its reservations.'}
          </p>
        </>
      )}

    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  onPrev,
  onNext
}) {
  if (totalItems === 0) return null;

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t text-xs text-muted-foreground">
      <p>
        Showing {(page - 1) * PAGE_SIZE + 1}-
        {Math.min(page * PAGE_SIZE, totalItems)} of {totalItems}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 rounded-full"
          onClick={onPrev}
          disabled={page === 1}
        >
          Prev
        </Button>

        <span>
          Page {page} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          className="h-7 rounded-full"
          onClick={onNext}
          disabled={page === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function groupWaitlistBySlot(entries) {
  const groups = {};

  entries.forEach((entry) => {
    const key = `${entry.court_id}-${entry.date}-${entry.start_time}`;

    if (!groups[key]) {
      groups[key] = {
        key,
        courtName: entry.court_name,
        date: entry.date,
        startTime: entry.start_time,
        endTime: entry.end_time,
        people: []
      };
    }

    groups[key].people.push(entry);
  });

  return Object.values(groups);
}

function groupReservationsByCourtAndSlot(entries) {
  const courts = {};

  entries.forEach((r) => {
    if (!courts[r.court_name]) {
      courts[r.court_name] = {};
    }

    const slotKey = `${r.date}-${r.start_time}`;

    if (!courts[r.court_name][slotKey]) {
      courts[r.court_name][slotKey] = {
        date: r.date,
        startTime: r.start_time,
        endTime: r.end_time,
        reservations: []
      };
    }

    courts[r.court_name][slotKey].reservations.push(r);
  });

  return Object.entries(courts).map(([courtName, slots]) => ({
    courtName,
    slots: Object.values(slots)
  }));
}

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [occupancy, setOccupancy] = useState([]);
  const [activity, setActivity] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [activeSection, setActiveSection] = useState('reservations');
  const [statusFilter, setStatusFilter] = useState('approved');
  const [waitlistPage, setWaitlistPage] = useState(1);
  const [expandedSlot, setExpandedSlot] = useState(null);
  const [expandedCourt, setExpandedCourt] = useState(null);
  const [expandedResSlot, setExpandedResSlot] = useState(null);

  const [dailySeen, setDailySeen] = useState(loadDailySeenState);

  const [courtDialogOpen, setCourtDialogOpen] = useState(false);
  const [courtName, setCourtName] = useState('');
  const [courtLocation, setCourtLocation] = useState('');
  const [addingCourt, setAddingCourt] = useState(false);
  const [courtError, setCourtError] = useState('');

  const { liveStats } = useNotifications();

  const token = localStorage.getItem('token');
  const headers = {
    Authorization: `Bearer ${token}`
  };

  async function fetchDashboard() {
    try {
      const [
        statsRes,
        occupancyRes,
        activityRes,
        reservationsRes,
        waitlistRes,
        courtsRes
      ] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/admin/stats`, {
          headers
        }),

        fetch(`${import.meta.env.VITE_API_URL}/api/admin/occupancy`, {
          headers
        }),

        fetch(`${import.meta.env.VITE_API_URL}/api/admin/activity`, {
          headers
        }),

        fetch(`${import.meta.env.VITE_API_URL}/api/reservations/manage`, {
          headers
        }),

        fetch(`${import.meta.env.VITE_API_URL}/api/waitlist`, {
          headers
        }),

        fetch(`${import.meta.env.VITE_API_URL}/api/courts`, {
          headers
        }),
      ]);

      if (
        !statsRes.ok ||
        !occupancyRes.ok ||
        !activityRes.ok ||
        !reservationsRes.ok ||
        !waitlistRes.ok ||
        !courtsRes.ok
      ) {
        throw new Error('Failed to load dashboard');
      }

      setStats(await statsRes.json());
      setOccupancy(await occupancyRes.json());
      setActivity(await activityRes.json());
      setReservations(await reservationsRes.json());
      setWaitlist(await waitlistRes.json());
      setCourts(await courtsRes.json());
    } catch (err) {
      console.error(err);
      setError('Could not load the admin dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

  /* =========================================================
     RESET NEW INDICATORS EVERY DAY
     ========================================================= */

  useEffect(() => {
    const interval = setInterval(() => {
      const today = getLocalDateKey();

      setDailySeen((current) => {
        if (current.date === today) {
          return current;
        }

        const resetState = emptyDailySeenState();

        saveDailySeenState(resetState);

        return resetState;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  /* =========================================================
     MARK RESERVATION / WAITLIST AS SEEN
     ========================================================= */

  function markReservationSeen(id) {
    setDailySeen((current) => {
      const today = getLocalDateKey();

      const base =
        current.date === today
          ? current
          : emptyDailySeenState();

      if (base.reservationIds.includes(id)) {
        return base;
      }

      const next = {
        ...base,
        reservationIds: [
          ...base.reservationIds,
          id
        ],
      };

      saveDailySeenState(next);

      return next;
    });
  }

  function markWaitlistSeen(id) {
    setDailySeen((current) => {
      const today = getLocalDateKey();

      const base =
        current.date === today
          ? current
          : emptyDailySeenState();

      if (base.waitlistIds.includes(id)) {
        return base;
      }

      const next = {
        ...base,
        waitlistIds: [
          ...base.waitlistIds,
          id
        ],
      };

      saveDailySeenState(next);

      return next;
    });
  }

  function isCreatedToday(dateString) {
    if (!dateString) return false;

    const parsedDate = new Date(dateString);

    if (Number.isNaN(parsedDate.getTime())) {
      return false;
    }

    return (
      getLocalDateKey(parsedDate) ===
      getLocalDateKey()
    );
  }

  function isNewPendingReservation(reservation) {
    return (
      reservation.status === 'pending' &&
      isCreatedToday(reservation.created_at) &&
      !dailySeen.reservationIds.includes(reservation.id)
    );
  }

  function isNewWaitlistEntry(entry) {
    return (
      isCreatedToday(entry.created_at) &&
      !dailySeen.waitlistIds.includes(entry.id)
    );
  }

  /* ========================================================= */

  async function handleApprove(id) {
    setActioningId(id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/reservations/${id}/approve`,
        {
          method: 'POST',
          headers
        }
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to approve');
        return;
      }

      await fetchDashboard();
    } catch (err) {
      console.error(err);
      alert('Something went wrong.');
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(id) {
    if (!window.confirm('Reject this reservation?')) return;

    setActioningId(id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/reservations/${id}/reject`,
        {
          method: 'POST',
          headers
        }
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to reject');
        return;
      }

      await fetchDashboard();
    } catch (err) {
      console.error(err);
      alert('Something went wrong.');
    } finally {
      setActioningId(null);
    }
  }

  async function handleCancel(id) {
    if (!window.confirm('Cancel this reservation?')) return;

    setActioningId(id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/reservations/${id}/cancel`,
        {
          method: 'POST',
          headers
        }
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to cancel');
        return;
      }

      await fetchDashboard();
    } catch (err) {
      console.error(err);
      alert('Something went wrong.');
    } finally {
      setActioningId(null);
    }
  }

  async function handleCheckIn(id) {
    setActioningId(id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/reservations/${id}/checkin`,
        {
          method: 'POST',
          headers
        }
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to check in');
        return;
      }

      await fetchDashboard();
    } catch (err) {
      console.error(err);
      alert('Something went wrong.');
    } finally {
      setActioningId(null);
    }
  }

  async function handleNoShow(id) {
    if (
      !window.confirm(
        'Mark this reservation as a no-show?'
      )
    ) {
      return;
    }

    setActioningId(id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/reservations/${id}/no-show`,
        {
          method: 'POST',
          headers
        }
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to mark no-show');
        return;
      }

      await fetchDashboard();
    } catch (err) {
      console.error(err);
      alert('Something went wrong.');
    } finally {
      setActioningId(null);
    }
  }

  async function handleAddCourt(e) {
    e.preventDefault();

    setCourtError('');
    setAddingCourt(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/courts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify({
            name: courtName,
            location: courtLocation
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setCourtError(
          data.error || 'Failed to add court'
        );
        return;
      }

      setCourtName('');
      setCourtLocation('');
      setCourtDialogOpen(false);

      await fetchDashboard();
    } catch (err) {
      console.error(err);
      setCourtError('Something went wrong.');
    } finally {
      setAddingCourt(false);
    }
  }

  async function handleDeleteCourt(id) {
    if (
      !window.confirm(
        'Delete this court permanently?'
      )
    ) {
      return;
    }

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/courts/${id}`,
      {
        method: 'DELETE',
        headers
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || 'Failed to delete');
      return;
    }

    fetchDashboard();
  }

  async function handleCancelWaitlistEntry(id) {
    if (
      !window.confirm(
        'Remove this person from the waitlist?'
      )
    ) {
      return;
    }

    setActioningId(id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/waitlist/${id}`,
        {
          method: 'DELETE',
          headers
        }
      );

      if (!response.ok) {
        const data = await response.json();

        alert(
          data.error ||
          'Failed to remove from waitlist'
        );

        return;
      }

      await fetchDashboard();
    } catch (err) {
      console.error(err);
      alert('Something went wrong.');
    } finally {
      setActioningId(null);
    }
  }

  async function handleExportAuditLog() {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/admin/audit-log`,
        {
          headers
        }
      );

      if (!response.ok) {
        alert('Failed to export audit log');
        return;
      }

      const data = await response.json();

      const header =
        'ID,Event Type,Payload,Created At\n';

      const rows = data
        .map(
          (entry) =>
            `${entry.id},"${entry.event_type}","${JSON.stringify(
              entry.payload_json
            ).replace(/"/g, '""')}",${entry.created_at}`
        )
        .join('\n');

      const blob = new Blob(
        [header + rows],
        {
          type: 'text/csv'
        }
      );

      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');

      link.href = url;

      link.download = `audit-log-${new Date()
        .toISOString()
        .split('T')[0]}.csv`;

      link.click();
    } catch (err) {
      console.error(err);
      alert(
        'Something went wrong exporting the audit log.'
      );
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        {error}
      </div>
    );
  }

  const activeWaitlist = waitlist.filter(
    (w) =>
      w.status === 'waiting' ||
      w.status === 'offered'
  );

  const groupedWaitlist =
    groupWaitlistBySlot(activeWaitlist);

  const waitlistTotalPages =
    Math.max(
      1,
      Math.ceil(
        groupedWaitlist.length / PAGE_SIZE
      )
    );

  const paginatedWaitlistGroups =
    groupedWaitlist.slice(
      (waitlistPage - 1) * PAGE_SIZE,
      waitlistPage * PAGE_SIZE
    );

  const filteredReservations =
    statusFilter === 'all'
      ? reservations
      : reservations.filter(
          (r) => r.status === statusFilter
        );

  const groupedReservations =
    groupReservationsByCourtAndSlot(
      filteredReservations
    );

  const statusFilters = [
    {
      key: 'approved',
      label: 'Approved'
    },
    {
      key: 'pending',
      label: 'Pending'
    },
    {
      key: 'rejected',
      label: 'Rejected'
    },
    {
      key: 'cancelled',
      label: 'Cancelled'
    },
    {
      key: 'all',
      label: 'All'
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      <div className="flex items-start justify-between">

        <h1 className="text-3xl font-extrabold tracking-tight">
          Admin Dashboard
        </h1>

        <div className="flex gap-2">

          <Button
            variant="outline"
            className="rounded-full"
            onClick={handleExportAuditLog}
          >
            <Download className="h-4 w-4 text-orange-500" />
            Export Audit Log
          </Button>

          <Dialog
            open={courtDialogOpen}
            onOpenChange={setCourtDialogOpen}
          >

            <DialogTrigger className="rounded-full bg-primary text-primary-foreground h-9 px-4 inline-flex items-center gap-2 text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" />
              Add Court
            </DialogTrigger>

            <DialogContent>

              <DialogHeader>
                <DialogTitle>
                  Add a New Court
                </DialogTitle>
              </DialogHeader>

              <form
                onSubmit={handleAddCourt}
                className="space-y-4"
              >

                <div className="space-y-2">

                  <Label htmlFor="courtName">
                    Court Name
                  </Label>

                  <Input
                    id="courtName"
                    value={courtName}
                    onChange={(e) =>
                      setCourtName(e.target.value)
                    }
                    required
                  />

                </div>

                <div className="space-y-2">

                  <Label htmlFor="courtLocation">
                    Location
                  </Label>

                  <Input
                    id="courtLocation"
                    value={courtLocation}
                    onChange={(e) =>
                      setCourtLocation(e.target.value)
                    }
                  />

                </div>

                {courtError && (
                  <p className="text-sm text-red-500">
                    {courtError}
                  </p>
                )}

                <DialogFooter>

                  <Button
                    type="submit"
                    disabled={addingCourt}
                  >
                    {addingCourt
                      ? 'Adding...'
                      : 'Add Court'}
                  </Button>

                </DialogFooter>

              </form>

            </DialogContent>

          </Dialog>

        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        <div className="lg:col-span-2 grid grid-cols-2 gap-4">

          <StatCard
            icon={ClipboardList}
            label="Reservations"
            value={stats.activeReservations}
            sublabel="Currently approved"
          />

          <StatCard
            icon={TrendingUp}
            label="Waitlist Size"
            value={stats.waitlistSize}
            sublabel="Residents waiting"
          />

          <StatCard
            icon={Building2}
            label="Courts Available"
            value={`${stats.courtsAvailable}/${stats.courtsTotal}`}
            sublabel={`${stats.publicEvents} public events today`}
          />

          <Card className="border-0 shadow-sm">

            <CardContent className="p-5">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1.5">

                    <span className="relative flex h-2 w-2">

                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />

                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />

                    </span>

                    Live Now

                  </p>

                  <p className="text-3xl font-bold tracking-tight">
                    {liveStats.activeNow}
                  </p>

                  <p className="text-xs text-muted-foreground mt-1">
                    Courts in use this minute
                  </p>

                </div>

                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-orange-50 text-orange-600">
                  <Building2 className="h-5 w-5" />
                </div>

              </div>

            </CardContent>

          </Card>

        </div>

        <Card className="lg:col-span-3 border-0 shadow-sm">

          <CardContent className="p-5">

            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              Reservations Over Time
            </h3>

            <ReservationDrillDownChart />

          </CardContent>

        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <Card className="lg:col-span-2 border-0 shadow-sm">

          <CardContent className="p-5">

            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-500" />
              Today's Court Occupancy
            </h3>

            <div className="space-y-3">

              {occupancy.map((court) => (

                <div
                  key={court.id}
                  className="flex items-center gap-3"
                >

                  <span className="text-sm font-medium w-32 truncate">
                    {court.name}
                  </span>

                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">

                    <div
                      className="h-full rounded-full bg-orange-500 transition-all"
                      style={{
                        width: `${court.occupancyPercent}%`
                      }}
                    />

                  </div>

                  <span className="text-xs text-muted-foreground w-9 text-right">
                    {court.occupancyPercent}%
                  </span>

                </div>

              ))}

            </div>

          </CardContent>

        </Card>

        <Card className="border-0 shadow-sm">

          <CardContent className="p-5">

            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500" />
              Recent Activity
            </h3>

            {activity.length === 0 ? (

              <p className="text-sm text-muted-foreground">
                No activity yet.
              </p>

            ) : (

              <div className="space-y-3">

                {[...activity]
                  .reverse()
                  .map((entry, i) => (

                    <div
                      key={i}
                      className="flex items-start gap-2.5"
                    >

                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${activityDot(entry.event_type)}`}
                      />

                      <div className="min-w-0">

                        <p className="text-sm leading-tight">
                          {activityLabel(entry.event_type)}
                        </p>

                        <p className="text-xs text-muted-foreground mt-0.5">
                          {timeAgo(entry.created_at)}
                        </p>

                      </div>

                    </div>

                  ))}

              </div>

            )}

          </CardContent>

        </Card>

      </div>

      <Card className="border-0 shadow-sm overflow-hidden">

        <div className="flex items-center justify-between px-5 pt-4 flex-wrap gap-2">

          <div className="flex gap-1">

            <button
              onClick={() =>
                setActiveSection('reservations')
              }
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                activeSection === 'reservations'
                  ? 'bg-primary text-white font-medium'
                  : 'text-muted-foreground hover:bg-slate-100'
              }`}
            >

              <span className="inline-flex items-center gap-1.5">

                Reservations

                {reservations.some(
                  isNewPendingReservation
                ) && (
                  <span
                    className="h-2 w-2 rounded-full bg-red-500"
                    title="New pending reservations"
                  />
                )}

              </span>

            </button>

            <button
              onClick={() =>
                setActiveSection('waitlist')
              }
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                activeSection === 'waitlist'
                  ? 'bg-primary text-white font-medium'
                  : 'text-muted-foreground hover:bg-slate-100'
              }`}
            >

              <span className="inline-flex items-center gap-1.5">

                Waitlist
                {activeWaitlist.length > 0
                  ? ` · ${activeWaitlist.length}`
                  : ''}

                {activeWaitlist.some(
                  isNewWaitlistEntry
                ) && (
                  <span
                    className="h-2 w-2 rounded-full bg-red-500"
                    title="New waitlist entries"
                  />
                )}

              </span>

            </button>

            <button
              onClick={() =>
                setActiveSection('courts')
              }
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                activeSection === 'courts'
                  ? 'bg-primary text-white font-medium'
                  : 'text-muted-foreground hover:bg-slate-100'
              }`}
            >
              Courts
            </button>

          </div>

          {activeSection === 'reservations' && (

            <div className="flex gap-1">

              {statusFilters.map((f) => (

                <button
                  key={f.key}
                  onClick={() =>
                    setStatusFilter(f.key)
                  }
                  className={`px-2.5 py-1 text-xs rounded-full transition-colors border ${
                    statusFilter === f.key
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'text-muted-foreground border-slate-200 hover:bg-slate-50'
                  }`}
                >

                  <span className="inline-flex items-center gap-1.5">

                    {f.label}

                    {f.key === 'pending' &&
                      reservations.some(
                        isNewPendingReservation
                      ) && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-red-500"
                          title="New pending reservations"
                        />
                      )}

                  </span>

                </button>

              ))}

            </div>

          )}

        </div>

        <CardContent className="p-0 mt-2">

          {activeSection === 'reservations' && (

            groupedReservations.length === 0 ? (

              <p className="p-8 text-center text-sm text-muted-foreground">
                No reservations found.
              </p>

            ) : (

              <div className="divide-y">

                {groupedReservations.map(
                  (courtGroup) => (

                    <div key={courtGroup.courtName}>

                      <button
                        onClick={() =>
                          setExpandedCourt(
                            expandedCourt ===
                              courtGroup.courtName
                              ? null
                              : courtGroup.courtName
                          )
                        }
                        className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                      >

                        <p className="text-sm font-semibold flex-1">
                          {courtGroup.courtName}
                        </p>

                        <Badge
                          variant="secondary"
                          className="rounded-full text-xs"
                        >
                          {courtGroup.slots.reduce(
                            (sum, s) =>
                              sum +
                              s.reservations.length,
                            0
                          )}
                          {' '}bookings
                        </Badge>

                        {expandedCourt ===
                        courtGroup.courtName ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}

                      </button>

                      {expandedCourt ===
                        courtGroup.courtName && (

                        <div className="bg-slate-50">

                          {courtGroup.slots.map(
                            (slot) => {

                              const slotKey =
                                `${courtGroup.courtName}-${slot.date}-${slot.startTime}`;

                              const hasNewPendingReservation =
                                slot.reservations.some(
                                  isNewPendingReservation
                                );

                              return (

                                <div
                                  key={slotKey}
                                  className="border-t"
                                >

                                  <button
                                    onClick={() =>
                                      setExpandedResSlot(
                                        expandedResSlot ===
                                          slotKey
                                          ? null
                                          : slotKey
                                      )
                                    }
                                    className="w-full flex items-center gap-4 px-8 py-2.5 hover:bg-slate-100 transition-colors text-left"
                                  >

                                    <p className="text-xs font-medium flex-1 flex items-center gap-2">

                                      {hasNewPendingReservation && (
                                        <span
                                          className="h-2 w-2 rounded-full bg-red-500 shrink-0"
                                          title="New pending reservation"
                                        />
                                      )}

                                      <span>
                                        {formatDateDisplay(
                                          slot.date
                                        )}
                                        {' · '}
                                        {formatTime12Hour(
                                          slot.startTime
                                        )}
                                        {' - '}
                                        {formatTime12Hour(
                                          slot.endTime
                                        )}
                                      </span>

                                    </p>

                                    <Badge
                                      variant="secondary"
                                      className="rounded-full text-xs"
                                    >
                                      {slot.reservations.length}
                                    </Badge>

                                    {expandedResSlot ===
                                    slotKey ? (
                                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}

                                  </button>

                                  {expandedResSlot ===
                                    slotKey && (

                                    <div className="px-8 pb-2 space-y-2">

                                      {slot.reservations.map(
                                        (r) => (

                                          <div
                                            key={r.id}
                                            onClick={() =>
                                              r.status ===
                                                'pending' &&
                                              markReservationSeen(
                                                r.id
                                              )
                                            }
                                            className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border cursor-pointer"
                                          >

                                            {isNewPendingReservation(
                                              r
                                            ) && (
                                              <span
                                                className="h-2 w-2 rounded-full bg-red-500 shrink-0"
                                                title="New pending reservation"
                                              />
                                            )}

                                            <div
                                              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(
                                                r.user_name
                                              )}`}
                                            >
                                              {initials(
                                                r.user_name
                                              )}
                                            </div>

                                            <p className="text-sm flex-1 truncate">
                                              {r.user_name}
                                            </p>

                                            {r.is_public ? (
                                              <Badge
                                                variant="secondary"
                                                className="rounded-full text-xs"
                                              >
                                                Public
                                              </Badge>
                                            ) : null}

                                            {statusBadge(
                                              r.status
                                            )}

                                            <div className="flex gap-1.5 shrink-0">

                                              {r.status ===
                                                'pending' && (

                                                <>
                                                  <Button
                                                    size="icon"
                                                    className="h-7 w-7 rounded-full bg-emerald-500 hover:bg-emerald-600"
                                                    onClick={() =>
                                                      handleApprove(
                                                        r.id
                                                      )
                                                    }
                                                    disabled={
                                                      actioningId ===
                                                      r.id
                                                    }
                                                  >
                                                    <Check className="h-3.5 w-3.5" />
                                                  </Button>

                                                  <Button
                                                    size="icon"
                                                    variant="destructive"
                                                    className="h-7 w-7 rounded-full"
                                                    onClick={() =>
                                                      handleReject(
                                                        r.id
                                                      )
                                                    }
                                                    disabled={
                                                      actioningId ===
                                                      r.id
                                                    }
                                                  >
                                                    <XIcon className="h-3.5 w-3.5" />
                                                  </Button>
                                                </>

                                              )}

                                              {r.status ===
                                                'approved' &&
                                                !r.checked_in && (

                                                <>

                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="rounded-full text-xs h-7"
                                                    onClick={() =>
                                                      handleCheckIn(
                                                        r.id
                                                      )
                                                    }
                                                    disabled={
                                                      actioningId ===
                                                      r.id
                                                    }
                                                  >
                                                    Check In
                                                  </Button>

                                                  {isPastGracePeriod(
                                                    r.date,
                                                    r.start_time
                                                  ) && (

                                                    <Button
                                                      size="sm"
                                                      variant="destructive"
                                                      className="rounded-full text-xs h-7"
                                                      onClick={() =>
                                                        handleNoShow(
                                                          r.id
                                                        )
                                                      }
                                                      disabled={
                                                        actioningId ===
                                                        r.id
                                                      }
                                                    >
                                                      No Show
                                                    </Button>

                                                  )}

                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="rounded-full text-xs h-7"
                                                    onClick={() =>
                                                      handleCancel(
                                                        r.id
                                                      )
                                                    }
                                                    disabled={
                                                      actioningId ===
                                                      r.id
                                                    }
                                                  >
                                                    Cancel
                                                  </Button>

                                                </>

                                              )}

                                              {r.status ===
                                                'approved' &&
                                                r.checked_in ? (

                                                <Badge className="bg-blue-100 text-blue-700 rounded-full">
                                                  Checked In
                                                </Badge>

                                              ) : null}

                                            </div>

                                          </div>

                                        )
                                      )}

                                    </div>

                                  )}

                                </div>

                              );
                            }
                          )}

                        </div>

                      )}

                    </div>

                  )
                )}

              </div>

            )

          )}

          {activeSection === 'waitlist' && (

            paginatedWaitlistGroups.length === 0 ? (

              <p className="p-8 text-center text-sm text-muted-foreground">
                No one is currently waitlisted.
              </p>

            ) : (

              <>

                <div className="divide-y">

                  {paginatedWaitlistGroups.map(
                    (group) => (

                      <div key={group.key}>

                        <button
                          onClick={() =>
                            setExpandedSlot(
                              expandedSlot ===
                                group.key
                                ? null
                                : group.key
                            )
                          }
                          className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                        >

                          <div className="min-w-0 flex-1">

                            <p className="text-sm font-medium flex items-center gap-2">

                              {group.people.some(
                                isNewWaitlistEntry
                              ) && (

                                <span
                                  className="h-2 w-2 rounded-full bg-red-500 shrink-0"
                                  title="New waitlist entry"
                                />

                              )}

                              <span>
                                {group.courtName}
                              </span>

                            </p>

                            <p className="text-xs text-muted-foreground">

                              {formatDateDisplay(
                                group.date
                              )}
                              {' · '}
                              {formatTime12Hour(
                                group.startTime
                              )}
                              {' - '}
                              {formatTime12Hour(
                                group.endTime
                              )}

                            </p>

                          </div>

                          <Badge
                            variant="secondary"
                            className="rounded-full text-xs shrink-0"
                          >
                            {group.people.length} waiting
                          </Badge>

                          {expandedSlot ===
                          group.key ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}

                        </button>

                        {expandedSlot ===
                          group.key && (

                          <div className="bg-slate-50 px-5 py-2 space-y-2">

                            {group.people.map(
                              (person, i) => (

                                <div
                                  key={person.id}
                                  onClick={() =>
                                    markWaitlistSeen(
                                      person.id
                                    )
                                  }
                                  className="flex items-center gap-3 py-1.5 cursor-pointer"
                                >

                                  {isNewWaitlistEntry(
                                    person
                                  ) && (

                                    <span
                                      className="h-2 w-2 rounded-full bg-red-500 shrink-0"
                                      title="New waitlist entry"
                                    />

                                  )}

                                  <span className="w-5 text-center text-xs font-semibold text-muted-foreground shrink-0">
                                    #{i + 1}
                                  </span>

                                  <Avatar className="h-7 w-7 shrink-0">

                                    <AvatarImage
                                      src={
                                        person.avatar_url
                                      }
                                    />

                                    <AvatarFallback
                                      className={`text-white text-xs ${avatarColor(
                                        person.user_name
                                      )}`}
                                    >
                                      {initials(
                                        person.user_name
                                      )}
                                    </AvatarFallback>

                                  </Avatar>

                                  <p className="text-sm flex-1 min-w-0 truncate">
                                    {person.user_name}
                                  </p>

                                  {statusBadge(
                                    person.status
                                  )}

                                  <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                                    {timeAgo(
                                      person.created_at
                                    )}
                                  </span>

                                  {person.status ===
                                    'waiting' && (

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                                      onClick={() =>
                                        handleCancelWaitlistEntry(
                                          person.id
                                        )
                                      }
                                      disabled={
                                        actioningId ===
                                        person.id
                                      }
                                    >
                                      Remove
                                    </Button>

                                  )}

                                </div>

                              )
                            )}

                          </div>

                        )}

                      </div>

                    )
                  )}

                </div>

                <Pagination
                  page={waitlistPage}
                  totalPages={waitlistTotalPages}
                  totalItems={
                    groupedWaitlist.length
                  }
                  onPrev={() =>
                    setWaitlistPage(
                      (p) =>
                        Math.max(1, p - 1)
                    )
                  }
                  onNext={() =>
                    setWaitlistPage(
                      (p) =>
                        Math.min(
                          waitlistTotalPages,
                          p + 1
                        )
                    )
                  }
                />

              </>

            )

          )}

          {activeSection === 'courts' && (

            <div className="divide-y">

              {courts.map((court) => (

                <div
                  key={court.id}
                  className="flex items-center gap-4 px-5 py-3"
                >

                  <div className="flex-1">

                    <p className="text-sm font-medium">
                      {court.name}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {court.location}
                    </p>

                  </div>

                  <span className="text-xs text-muted-foreground capitalize">
                    {court.status}
                  </span>

                  <Switch
                    checked={
                      court.status ===
                      'available'
                    }
                    onCheckedChange={async (
                      checked
                    ) => {

                      await fetch(
                        `${import.meta.env.VITE_API_URL}/api/courts/${court.id}/status`,
                        {
                          method: 'PATCH',
                          headers: {
                            'Content-Type':
                              'application/json',
                            ...headers
                          },
                          body: JSON.stringify({
                            status: checked
                              ? 'available'
                              : 'unavailable'
                          }),
                        }
                      );

                      fetchDashboard();
                    }}
                  />

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:bg-red-50"
                    onClick={() =>
                      handleDeleteCourt(
                        court.id
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                </div>

              ))}

            </div>

          )}

        </CardContent>

      </Card>

    </div>
  );
}

export default AdminDashboard;