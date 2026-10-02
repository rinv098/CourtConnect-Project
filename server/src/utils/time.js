// Barangay bookings are always in Philippine time, no matter where the server runs.
const OFFSET = '+08:00';

// "YYYY-MM-DD" for today in Manila
function todayInManila() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

// mysql2 returns DATE columns as local-time Date objects, so read them with local getters
function toDateString(value) {
  if (typeof value === 'string') return value.split('T')[0];
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Real Date for a Manila date + "HH:MM" or "HH:MM:SS" time
function manilaDateTime(date, time) {
  return new Date(`${toDateString(date)}T${time}${OFFSET}`);
}

module.exports = { todayInManila, toDateString, manilaDateTime };