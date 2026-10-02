const { GoogleGenAI } = require('@google/genai');
const db = require('../config/db');
const adminModel = require('../models/adminModel');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CACHE_MS = 60 * 60 * 1000; // safe: the cache key includes the data, so changed numbers always get a fresh summary
const cache = new Map();

const SYSTEM_PROMPT = `You write short statistics summaries for the admin of a barangay court reservation system in the Philippines.
Rules:
- Use only the numbers in the data provided. Never invent or estimate figures. Totals, peaks, averages and percent changes are already computed in "facts", so quote them as given.
- Write 3 to 5 plain-language sentences as one paragraph. No markdown, bullets, or headings.
- Cover the overall volume, the busiest and quietest periods, and any clear pattern the data shows (weekday vs weekend, popular courts, popular start times, popular activity categories).
- Mention the comparison with the previous period only if "previousPeriod" exists and its total is above zero.
- End with one practical suggestion for the admin only if the data clearly supports it.
- Reservation counts in the chart include pending and approved bookings only. "breakdown.status" also lists rejected, cancelled and no_show ones.
- Put it in a neatly format of by line instead of a paragraph form`;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const sum = (rows) => rows.reduce((total, r) => total + r.count, 0);
const dayOfWeek = (year, month, day) => new Date(Date.UTC(year, month - 1, day)).getUTCDay();

// Do the arithmetic here so the AI only has to describe it, not calculate it
function describeSeries(series) {
  const total = sum(series);
  const peak = series.reduce((a, b) => (b.count > a.count ? b : a), series[0]);
  const lowest = series.reduce((a, b) => (b.count < a.count ? b : a), series[0]);
  return {
    total,
    average: Number((total / series.length).toFixed(1)),
    peak: { label: peak.label, count: peak.count },
    lowest: { label: lowest.label, count: lowest.count },
    emptyPeriods: series.filter((s) => s.count === 0).length,
  };
}

function compareTo(currentTotal, label, previousTotal) {
  return {
    label,
    total: previousTotal,
    changePct: previousTotal === 0 ? null : Math.round(((currentTotal - previousTotal) / previousTotal) * 100),
  };
}

// Aggregates only. No names or emails are ever sent to the AI service.
async function getBreakdown(from, to) {
  const active = `status IN ('pending', 'approved')`;
  const [[statusRows], [courtRows], [timeRows], [categoryRows]] = await Promise.all([
    db.query(`SELECT status, COUNT(*) AS count FROM reservations WHERE date BETWEEN ? AND ? GROUP BY status`, [from, to]),
    db.query(
      `SELECT c.name, COUNT(*) AS count FROM reservations r JOIN courts c ON r.court_id = c.id
       WHERE r.${active} AND r.date BETWEEN ? AND ? GROUP BY c.id, c.name ORDER BY count DESC LIMIT 3`,
      [from, to]
    ),
    db.query(
      `SELECT HOUR(start_time) AS hour, COUNT(*) AS count FROM reservations
       WHERE ${active} AND date BETWEEN ? AND ? GROUP BY HOUR(start_time) ORDER BY count DESC, hour LIMIT 3`,
      [from, to]
    ),
    db.query(
      `SELECT category, COUNT(*) AS count FROM reservations
       WHERE ${active} AND category IS NOT NULL AND date BETWEEN ? AND ? GROUP BY category ORDER BY count DESC LIMIT 3`,
      [from, to]
    ),
  ]);
  return {
    status: Object.fromEntries(statusRows.map((r) => [r.status, r.count])),
    topCourts: courtRows.map((r) => ({ name: r.name, count: r.count })),
    peakStartTimes: timeRows.map((r) => ({ time: `${String(r.hour).padStart(2, '0')}:00`, count: r.count })),
    topCategories: categoryRows.map((r) => ({ category: r.category, count: r.count })),
  };
}

function parseQuery(query) {
  const view = query.view;
  if (!['year', 'month', 'day'].includes(view)) throw new ValidationError('view must be year, month, or day');
  const year = parseInt(query.year, 10) || new Date().getFullYear();
  const month = parseInt(query.month, 10) || new Date().getMonth() + 1;
  if (year < 2000 || year > 2100) throw new ValidationError('Invalid year');
  if (view !== 'year' && (month < 1 || month > 12)) throw new ValidationError('Invalid month');
  if (view === 'day' && !/^\d{4}-\d{2}-\d{2}$/.test(query.date || '')) throw new ValidationError('date must be YYYY-MM-DD');
  return { view, year, month, date: query.date };
}

// Rebuilds the same numbers the chart shows, straight from the database (never trusts numbers sent by the browser)
async function buildPayload({ view, year, month, date }) {
  if (view === 'year') {
    const rows = await adminModel.getReservationsByMonth(year);
    const series = rows.map((r) => ({ label: MONTHS[r.month - 1], count: r.count }));
    const facts = describeSeries(series);
    facts.previousPeriod = compareTo(facts.total, String(year - 1), sum(await adminModel.getReservationsByMonth(year - 1)));
    const breakdown = await getBreakdown(`${year}-01-01`, `${year}-12-31`);
    return { view, period: String(year), unit: 'month', series, facts, breakdown };
  }

  if (view === 'month') {
    const rows = await adminModel.getReservationsByDayOfMonth(year, month);
    const series = rows.map((r) => ({
      label: `${MONTHS[month - 1]} ${r.day} (${WEEKDAYS[dayOfWeek(year, month, r.day)]})`,
      count: r.count,
    }));
    const facts = describeSeries(series);
    const weekend = rows.reduce((t, r) => ([0, 6].includes(dayOfWeek(year, month, r.day)) ? t + r.count : t), 0);
    facts.weekendSharePct = facts.total ? Math.round((weekend / facts.total) * 100) : 0;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    facts.previousPeriod = compareTo(
      facts.total,
      `${MONTHS[prevMonth - 1]} ${prevYear}`,
      sum(await adminModel.getReservationsByDayOfMonth(prevYear, prevMonth))
    );
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const breakdown = await getBreakdown(`${year}-${mm}-01`, `${year}-${mm}-${String(lastDay).padStart(2, '0')}`);
    return { view, period: `${MONTHS[month - 1]} ${year}`, unit: 'day', series, facts, breakdown };
  }

  const records = await adminModel.getReservationsForDate(date);
  const [y, m, d] = date.split('-').map(Number);
  return {
    view,
    period: `${date} (${WEEKDAYS[dayOfWeek(y, m, d)]})`,
    unit: 'reservation',
    facts: { total: records.length },
    reservations: records.map((r) => ({
      court: r.court_name,
      start: r.start_time,
      end: r.end_time,
      status: r.status,
    })),
    breakdown: await getBreakdown(date, date),
  };
}

const isEmpty = (payload) => payload.facts.total === 0;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY is not set');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// Models are tried in order. Set GEMINI_MODEL to one name or a comma-separated list.
function getModels() {
  const list = process.env.GEMINI_MODEL || 'gemini-flash-latest,gemini-2.5-flash,gemini-2.5-flash-lite';
  return list.split(',').map((m) => m.trim()).filter(Boolean);
}

const RETRYABLE = [429, 500, 503, 504];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Busy-server errors (503, 429) are usually brief: retry once, then move on to the next model.
// Errors that retrying cannot fix (bad API key) are thrown straight away.
async function callWithFallback(client, models, request) {
  let firstError;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await client.models.generateContent({ ...request, model });
      } catch (err) {
        firstError = firstError || err;
        if (err.status === 404) break; // this model name doesn't exist, try the next one
        if (!RETRYABLE.includes(err.status)) throw err;
        if (attempt === 0) await sleep(1500);
      }
    }
  }
  throw firstError;
}

async function generateSummary(payload, client = getClient()) {
  const models = getModels();
  const key = `${models.join(',')}:${JSON.stringify(payload)}`;

  // Repeat clicks on the same view reuse the answer instead of spending free-tier quota
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.text;

  const response = await callWithFallback(client, models, {
    contents: `Summarize these reservation statistics:\n${JSON.stringify(payload)}`,
    config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.3, maxOutputTokens: 2048 },
  });

  const text = (response.text || '').trim();
  if (!text) throw new Error('The AI returned an empty response');

  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(key, { text, expires: Date.now() + CACHE_MS });
  return text;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Last resort for when Gemini is temporarily unavailable: plain sentences built from the same computed numbers
function buildFallbackSummary(payload) {
  const { view, period, facts, breakdown, unit } = payload;
  const sentences = [];
  if (view === 'day') {
    sentences.push(`On ${period} there ${facts.total === 1 ? 'was 1 reservation' : `were ${facts.total} reservations`}.`);
  } else {
    sentences.push(`In ${period} there were ${facts.total} pending or approved reservations, about ${facts.average} per ${unit}.`);
    sentences.push(
      `The busiest ${unit} was ${facts.peak.label} with ${facts.peak.count}.` +
        (facts.emptyPeriods > 0
          ? ` ${plural(facts.emptyPeriods, unit)} had no reservations.`
          : ` The quietest was ${facts.lowest.label} with ${facts.lowest.count}.`)
    );
    const prev = facts.previousPeriod;
    if (prev && prev.total > 0) {
      sentences.push(
        prev.changePct === 0
          ? `That is unchanged from ${prev.label} (${prev.total}).`
          : `That is ${prev.changePct > 0 ? 'up' : 'down'} ${Math.abs(prev.changePct)}% from ${prev.label} (${prev.total}).`
      );
    }
    if (facts.weekendSharePct !== undefined) {
      sentences.push(`${facts.weekendSharePct}% of the bookings fell on weekends.`);
    }
  }
  const court = breakdown.topCourts[0];
  const time = breakdown.peakStartTimes[0];
  if (court) {
    sentences.push(`${court.name} was the most booked court (${court.count})` + (time ? `, and ${time.time} was the most common start time.` : '.'));
  }
  const { cancelled = 0, rejected = 0, no_show: noShow = 0 } = breakdown.status;
  if (cancelled + rejected + noShow > 0) {
    sentences.push(`Separately, ${cancelled} cancelled, ${rejected} rejected, and ${noShow} no-show reservations were recorded.`);
  }
  return sentences.join(' ');
}

async function getSummary(query, client) {
  const payload = await buildPayload(parseQuery(query));
  if (isEmpty(payload)) {
    return {
      summary: `There are no reservations recorded for ${payload.period}, so there is nothing to summarize yet.`,
      source: 'empty',
    };
  }
  try {
    return { summary: await generateSummary(payload, client), source: 'ai' };
  } catch (err) {
    // Setup problems (missing or rejected API key, unknown model) must stay visible so they get fixed.
    // Temporary trouble (busy servers, quota, network) falls back to an automatic summary instead of an error.
    const temporary = err.code !== 'NOT_CONFIGURED' && (!err.status || RETRYABLE.includes(err.status));
    if (!temporary) throw err;
    console.error('Gemini unavailable, using automatic summary:', err.message);
    return { summary: buildFallbackSummary(payload), source: 'auto' };
  }
}

module.exports = { getSummary, buildFallbackSummary, buildPayload, generateSummary, parseQuery, ValidationError };