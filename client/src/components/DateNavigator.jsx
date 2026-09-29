import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parse(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(str, n) {
  const date = parse(str);
  date.setDate(date.getDate() + n);
  return toStr(date);
}

function DateNavigator({ value, onChange, min }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parse(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const popoverRef = useRef(null);
  const anchorRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const selected = parse(value);
  const isToday = value === min;
  const canGoPrev = value > min;

  // keep the popup's month in sync when the date changes via arrows or the week strip
  useEffect(() => {
    setViewMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    function handleOutside(e) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // popup is portaled to <body>, so position it against the button's real
  // screen position instead of relying on the (clipped) card as an anchor
  useEffect(() => {
    if (open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + window.scrollY + 8,
        left: rect.right + window.scrollX - 288, // 288px = popup width (w-72)
      });
    }
  }, [open]);

  useEffect(() => {
    function handleReposition() {
      if (open && anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        setPopoverPos({
          top: rect.bottom + window.scrollY + 8,
          left: rect.right + window.scrollX - 288,
        });
      }
    }
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [open]);

  // calendar grid for the month being viewed
  const firstWeekday = viewMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const minDate = parse(min);
  const canGoPrevMonth =
    viewMonth.getFullYear() > minDate.getFullYear() ||
    (viewMonth.getFullYear() === minDate.getFullYear() && viewMonth.getMonth() > minDate.getMonth());

  // the week (Sun to Sat) that contains the selected date
  const weekStart = addDays(value, -selected.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => canGoPrev && onChange(addDays(value, -1))}
            disabled={!canGoPrev}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-center min-w-[170px]">
            <p className="text-2xl font-bold leading-tight">
              {WEEKDAYS_LONG[selected.getDay()]}
              {isToday && (
                <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
                  Today
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {MONTHS[selected.getMonth()]} {selected.getDate()}, {selected.getFullYear()}
            </p>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => onChange(addDays(value, 1))}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2" ref={anchorRef}>
          {!isToday && (
            <Button variant="ghost" size="sm" className="text-orange-600" onClick={() => onChange(min)}>
              Back to today
            </Button>
          )}

          <Button variant="outline" onClick={() => setOpen((o) => !o)} className="gap-2">
            <CalendarDays className="h-4 w-4 text-orange-500" />
            Pick a date
          </Button>

          {open && createPortal(
            <div
              ref={popoverRef}
              style={{ position: 'absolute', top: popoverPos.top, left: Math.max(8, popoverPos.left) }}
              className="z-[9999] w-72 rounded-xl border bg-white p-3 shadow-xl animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!canGoPrevMonth}
                  onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm font-semibold">
                  {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground mb-1">
                {WEEKDAYS_SHORT.map((d) => (
                  <span key={d}>{d.slice(0, 2)}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) return <span key={`blank-${i}`} />;
                  const str = toStr(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
                  const disabled = str < min;
                  const isSelected = str === value;
                  const isTodayCell = str === min;
                  return (
                    <button
                      key={str}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onChange(str);
                        setOpen(false);
                      }}
                      className={`h-9 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? 'bg-orange-500 text-white font-semibold'
                          : disabled
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'hover:bg-orange-50'
                      } ${isTodayCell && !isSelected ? 'ring-1 ring-orange-300' : ''}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* quick week strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((str) => {
          const d = parse(str);
          const disabled = str < min;
          const isSelected = str === value;
          return (
            <button
              key={str}
              type="button"
              disabled={disabled}
              onClick={() => onChange(str)}
              className={`rounded-xl py-2 flex flex-col items-center transition-colors border ${
                isSelected
                  ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                  : disabled
                  ? 'bg-slate-50 text-slate-300 border-transparent cursor-not-allowed'
                  : 'bg-white hover:bg-orange-50 border-slate-200'
              }`}
            >
              <span className="text-[11px] uppercase tracking-wide opacity-80">
                {WEEKDAYS_SHORT[d.getDay()]}
              </span>
              <span className="text-lg font-semibold leading-tight">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DateNavigator;