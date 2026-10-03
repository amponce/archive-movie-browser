// GET /api/stats  (Authorization: Bearer <STATS_TOKEN>): the numbers behind the /stats page.
import { timingSafeEqual } from 'node:crypto';
import { redis } from './_redis.js';
import { statsDay, onlineKey, groupSearches } from './_stats.js';
import posterIndex from '../public/poster-index.json' with { type: 'json' };

const BOARDS = ['opened', 'played', 'watched', 'searches', 'filters', 'referrers', 'pages', 'players', 'played-from', 'banner', 'tv', 'tuned', 'stayed', 'minutes', 'channel-minutes', 'clicks'];
const STAGES = ['visited', 'clicked', 'played', 'tuned in', 'watched 1+ min', 'watched 10+ min', 'watched 30+ min'];
const FUNNEL_DAYS = 14;
const FILM_BOARDS = ['opened', 'played', 'watched', 'minutes'];
const DAYS = 30;
const COMMUNITY_DAYS = 14;
const COUNTED = { 'profile-created': 'profiles', 'channel-created': 'channels', 'channel-edited': 'edits', 'channel-deleted': 'deleted' };

function allowed(request) {
  const expected = process.env.STATS_TOKEN || '';
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given), b = Buffer.from(expected);
  if (expected.length < 16 || a.length !== b.length) return false; // bytes, not characters
  return timingSafeEqual(a, b);
}

const pairs = (flat) => { const out = []; for (let i = 0; i < (flat || []).length; i += 2) out.push([flat[i], Number(flat[i + 1])]); return out; };

export async function GET(request, env) {
  if (!allowed(request)) return new Response('Not found', { status: 404 });
  // The last 30 Pacific days, counted back from today's date (noon UTC, so no daylight saving edge)
  const today = new Date(`${statsDay()}T12:00:00Z`);
  const days = Array.from({ length: DAYS }, (_, i) => new Date(today - i * 86400_000).toISOString().slice(0, 10)).reverse();
  const month = days.at(-1).slice(0, 7);
  try {
    return await read(days, month, env?.DB);
  } catch (error) {
    const full = /max requests limit/i.test(error.message);
    return Response.json({ error: full ? 'The stats database has reached its monthly limit, so there is nothing to read until it resets or its plan is upgraded.' : `The stats database did not answer (${error.message}).` }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

async function read(days, month, db) {
  // Redis treats PFCOUNT as a write (it caches its answer in the key), so the read-only token
  // is refused for it. Visitor counts use the main token; everything else reads read-only.
  const [reads, visitors] = await Promise.all([
    redis([
      ...days.map(day => ['HGETALL', `stats:day:${day}`]),
      ...BOARDS.map(board => ['ZREVRANGE', `stats:${board}:${month}`, 0, board === 'searches' ? 199 : 24, 'WITHSCORES']),
      ['LRANGE', 'stats:recent', 0, 39],
    ], { readOnly: true }),
    redis([
      ...days.map(day => ['PFCOUNT', `stats:visitors:${day}`]), ['PFCOUNT', `stats:visitors:${month}`],
      // The funnel: how many visits reached each stage, per day
      ...days.slice(-FUNNEL_DAYS).flatMap(day => STAGES.map(stage => ['PFCOUNT', `stats:funnel:${stage}:${day}`])),
      // Active now: distinct visits in this five-minute window and the last one (5 to 10 minutes)
      ['PFCOUNT', onlineKey(new Date()), onlineKey(new Date(), 1)],
    ]),
  ]);

  const boards = Object.fromEntries(BOARDS.map((board, i) => [board, pairs(reads[DAYS + i])]));
  const searches = groupSearches(boards.searches, month);
  const people = searches.length ? await redis(searches.map(row => ['PFCOUNT', ...row.keys])) : [];
  boards.searches = searches.map((row, i) => [row.label, row.count, people[i] || 0]);
  const recent = (reads[DAYS + BOARDS.length] || []).flatMap(entry => { try { return [JSON.parse(entry)]; } catch { return []; } });

  // Names for every film the page will mention
  const films = [...new Set([...FILM_BOARDS.flatMap(board => boards[board].map(([film]) => film)), ...recent.map(event => event.data?.film).filter(Boolean)])];
  const names = films.length ? (await redis([['HMGET', 'stats:titles', ...films]], { readOnly: true }))[0] : [];
  const titles = Object.fromEntries(films.map((film, i) => [film, names[i]]).filter(([, title]) => title));

  const [saves, community] = await Promise.all([savesOf(db), communityOf(db, days.slice(-COMMUNITY_DAYS))]);
  for (const [film] of [...saves.hearted, ...saves.channels]) if (!titles[film] && posterIndex.films[film]?.t) titles[film] = posterIndex.films[film].t;

  const body = {
    month,
    saves,
    community,
    days: days.map((day, i) => ({ day, visitors: visitors[i] || 0, events: Object.fromEntries(pairs(reads[i])) })),
    visitorsThisMonth: visitors[DAYS] || 0,
    activeNow: visitors.at(-1) || 0,
    funnel: days.slice(-FUNNEL_DAYS).map((day, i) => ({ day, ...Object.fromEntries(STAGES.map((stage, j) => [stage, visitors[DAYS + 1 + i * STAGES.length + j] || 0])) })),
    boards,
    titles,
    recent,
  };
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

// Hearts and channel films from the community database, all time: counts per film, never who
export async function savesOf(db) {
  const none = { hearted: [], channels: [], totals: null };
  if (!db) return none;
  try {
    const [hearted, channels, totals] = await db.batch([
      db.prepare('SELECT f.film_id, COUNT(*) n FROM favourites f JOIN profiles p ON p.id = f.profile_id WHERE p.hidden = 0 GROUP BY f.film_id ORDER BY n DESC, MAX(f.created) DESC LIMIT 25'),
      db.prepare("SELECT f.film_id, COUNT(DISTINCT f.channel_id) n FROM channel_films f JOIN channels c ON c.id = f.channel_id WHERE c.status != 'hidden' GROUP BY f.film_id ORDER BY n DESC, f.film_id LIMIT 25"),
      db.prepare("SELECT (SELECT COUNT(*) FROM favourites) hearts, (SELECT COUNT(DISTINCT profile_id) FROM favourites) hearters, (SELECT COUNT(*) FROM channels WHERE status != 'hidden') channels, (SELECT COUNT(*) FROM profiles) profiles"),
    ]);
    const rows = r => r.results.map(x => [x.film_id, x.n]);
    return { hearted: rows(hearted), channels: rows(channels), totals: totals.results[0] };
  } catch {
    return none;
  }
}

// Changes from the history table: counts per Pacific day, networks (by tag) that made 2 or more
// profiles in 7 days, and the latest 20 changes with the first 6 characters of their tag
export async function communityOf(db, days, now = Date.now()) {
  if (!db) return null;
  try {
    const kinds = Object.keys(COUNTED);
    // From a day before the first day, so every Pacific hour of it is in; other days are dropped
    const since = Date.parse(`${days[0]}T00:00:00Z`) - 86_400_000;
    const [hours, networks, latest] = await db.batch([
      db.prepare(`SELECT kind, at / 3600000 AS hour, COUNT(*) n FROM history WHERE at >= ? AND kind IN (${kinds.map(() => '?').join(', ')}) GROUP BY kind, hour`).bind(since, ...kinds),
      db.prepare("SELECT net, COUNT(*) profiles FROM history WHERE kind = 'profile-created' AND net IS NOT NULL AND at >= ? GROUP BY net HAVING COUNT(*) >= 2 ORDER BY profiles DESC, MAX(at) DESC LIMIT 10").bind(now - 7 * 86_400_000),
      db.prepare("SELECT h.at, h.kind, substr(h.net, 1, 6) net, CASE WHEN h.channel_id IS NOT NULL THEN COALESCE(c.name, json_extract(h.detail, '$.name')) END channel, p.name, p.handle FROM history h LEFT JOIN channels c ON c.id = h.channel_id LEFT JOIN profiles p ON p.id = h.profile_id ORDER BY h.id DESC LIMIT 20"),
    ]);
    // Pacific time is a whole number of hours from UTC, so each hour falls in one Pacific day
    const counts = Object.fromEntries(days.map(day => [day, { day, profiles: 0, channels: 0, edits: 0, deleted: 0 }]));
    for (const { kind, hour, n } of hours.results) {
      const day = counts[statsDay(new Date(hour * 3_600_000))];
      if (day) day[COUNTED[kind]] += n;
    }
    return { days: days.map(day => counts[day]), networks: networks.results, latest: latest.results };
  } catch {
    return null;
  }
}
