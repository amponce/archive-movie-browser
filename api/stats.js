// GET /api/stats  (Authorization: Bearer <STATS_TOKEN>): the numbers behind the /stats page.
// Without a query: the last 30 days, 13 months of visitors, this month's boards and the latest log.
// ?searches=<month> every search that month; ?log=<offset> a page of the event log;
// ?profiles every profile; ?profile=<id> one profile's favourites, channels and changes.
import { timingSafeEqual } from 'node:crypto';
import { redis } from './_redis.js';
import { statsDay, onlineKey } from './_stats.js';
import posterIndex from '../public/poster-index.json' with { type: 'json' };

const BOARDS = ['opened', 'played', 'watched', 'searches', 'filters', 'referrers', 'pages', 'players', 'played-from', 'banner', 'tv', 'tuned', 'stayed', 'minutes', 'channel-minutes', 'clicks',
  'no-results', 'screens', 'tv-links', 'tv-apps', 'countries', 'browsers', 'systems'];
const MONTHS = 13; // visitors per month, this one and the twelve before
// Per film, for the films table: read for the most played and most opened films
const PER_FILM = ['played', 'opened', 'minutes', 'min1', 'played-archive', 'copy-failed', 'subs-minutes', ...Array.from({ length: 10 }, (_, i) => `reach-${i}`)];
const SEARCH_PEOPLE = 200; // searches in a full month's list that also get a count of visits
const STAGES = ['visited', 'clicked', 'played', 'tuned in', 'watched 1+ min', 'watched 10+ min', 'watched 30+ min'];
const FUNNEL_DAYS = 14;
const FILM_BOARDS = ['opened', 'played', 'watched', 'minutes', 'tv-links'];
const DAYS = 30;
const RECENT = 100; // log entries on every refresh: the latest panel and what is playing now
const COMMUNITY_DAYS = 14;
const COUNTED = { 'profile-created': 'profiles', 'channel-created': 'channels', 'channel-edited': 'edits', 'channel-deleted': 'deleted' };
const LOG_PAGE = 500;
const PROFILE_ID = /^[A-Za-z0-9_-]{1,64}$/;

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
  const params = new URL(request.url).searchParams;
  const searchMonth = params.get('searches');
  const offset = params.get('log');
  const profileId = params.get('profile');
  if (searchMonth && !/^\d{4}-\d{2}$/.test(searchMonth)) return new Response('Bad month', { status: 400 });
  if (offset !== null && !/^\d{1,7}$/.test(offset)) return new Response('Bad offset', { status: 400 });
  if (profileId !== null && !PROFILE_ID.test(profileId)) return new Response('Bad profile', { status: 400 });
  // The last 30 Pacific days, counted back from today's date (noon UTC, so no daylight saving edge)
  const today = new Date(`${statsDay()}T12:00:00Z`);
  const days = Array.from({ length: DAYS }, (_, i) => new Date(today - i * 86400_000).toISOString().slice(0, 10)).reverse();
  const months = Array.from({ length: MONTHS }, (_, i) => { const d = new Date(today); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7); }).reverse();
  try {
    if (searchMonth) return Response.json(await searchesOf(searchMonth), { headers: { 'Cache-Control': 'no-store' } });
    if (offset !== null) return Response.json(await logOf(Number(offset)), { headers: { 'Cache-Control': 'no-store' } });
    if (params.has('profiles')) return Response.json(await profilesOf(env?.DB), { headers: { 'Cache-Control': 'no-store' } });
    if (profileId !== null) return Response.json(await profileOf(env?.DB, profileId), { headers: { 'Cache-Control': 'no-store' } });
    return await read(days, months, env?.DB);
  } catch (error) {
    const full = /max requests limit/i.test(error.message);
    return Response.json({ error: full ? 'The stats database has reached its monthly limit, so there is nothing to read until it resets or its plan is upgraded.' : `The stats database did not answer (${error.message}).` }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

async function read(days, months, db) {
  const month = months.at(-1);
  // Redis treats PFCOUNT as a write (it caches its answer in the key), so the read-only token
  // is refused for it. Visitor counts use the main token; everything else reads read-only.
  const [reads, visitors] = await Promise.all([
    redis([
      ...days.map(day => ['HGETALL', `stats:day:${day}`]),
      ...BOARDS.map(board => ['ZREVRANGE', `stats:${board}:${month}`, 0, 24, 'WITHSCORES']),
      ['LRANGE', 'stats:recent', 0, RECENT - 1],
      ['ZRANGE', `stats:minutes:${month}`, 0, -1, 'WITHSCORES'],
      ['HGETALL', `stats:hours:${month}`],
      ['HGETALL', `stats:channel-hours:${month}`],
      ['HGETALL', `stats:visit-hours:${month}`],
    ], { readOnly: true }),
    redis([
      ...days.map(day => ['PFCOUNT', `stats:visitors:${day}`]), ['PFCOUNT', `stats:visitors:${month}`],
      // The funnel: how many visits reached each stage, per day
      ...days.slice(-FUNNEL_DAYS).flatMap(day => STAGES.map(stage => ['PFCOUNT', `stats:funnel:${stage}:${day}`])),
      // Visitors per month, oldest first
      ...months.map(m => ['PFCOUNT', `stats:visitors:${m}`]),
      // Active now: distinct visits in this five-minute window and the last one (5 to 10 minutes)
      ['PFCOUNT', onlineKey(new Date()), onlineKey(new Date(), 1)],
    ]),
  ]);
  const afterFunnel = DAYS + 1 + FUNNEL_DAYS * STAGES.length;

  const boards = Object.fromEntries(BOARDS.map((board, i) => [board, pairs(reads[DAYS + i])]));
  const people = boards.searches.length ? await redis(boards.searches.map(([query]) => ['PFCOUNT', `stats:searchers:${month}:${query}`])) : [];
  boards.searches = boards.searches.map(([query, count], i) => [query, count, people[i] || 0]);
  const after = DAYS + BOARDS.length;
  const recent = (reads[after] || []).flatMap(entry => { try { return [JSON.parse(entry)]; } catch { return []; } });
  const allMinutes = pairs(reads[after + 1]);
  const hours = Object.fromEntries(pairs(reads[after + 2]));
  const channelHours = Object.fromEntries(pairs(reads[after + 3]));
  const visitHours = Object.fromEntries(pairs(reads[after + 4]));

  // The films table: the most played and most opened films, each with every per-film count
  const tableFilms = [...new Set([...boards.played, ...boards.opened].map(([film]) => film))];
  const scores = tableFilms.length ? await redis(PER_FILM.map(board => ['ZMSCORE', `stats:${board}:${month}`, ...tableFilms]), { readOnly: true }) : [];
  const filmRows = tableFilms.map((film, i) => {
    const at = board => Number(scores[PER_FILM.indexOf(board)]?.[i]) || 0;
    return {
      film, length: posterIndex.films[film]?.l || null, played: at('played'), opened: at('opened'), minutes: at('minutes'), min1: at('min1'),
      archive: at('played-archive'), copyFailed: at('copy-failed'), subsMinutes: at('subs-minutes'), reach: Array.from({ length: 10 }, (_, k) => at(`reach-${k}`)),
    };
  });

  // Names for every film the page will mention
  const films = [...new Set([...FILM_BOARDS.flatMap(board => boards[board].map(([film]) => film)), ...tableFilms, ...recent.map(event => event.data?.film).filter(Boolean)])];
  const names = films.length ? (await redis([['HMGET', 'stats:titles', ...films]], { readOnly: true }))[0] : [];
  const titles = Object.fromEntries(films.map((film, i) => [film, names[i]]).filter(([, title]) => title));

  const [saves, community] = await Promise.all([savesOf(db), communityOf(db, days.slice(-COMMUNITY_DAYS))]);
  for (const [film] of [...saves.hearted, ...saves.channels, ...boards['tv-links']]) if (!titles[film] && posterIndex.films[film]?.t) titles[film] = posterIndex.films[film].t;

  const body = {
    month,
    saves,
    community,
    days: days.map((day, i) => ({ day, visitors: visitors[i] || 0, events: Object.fromEntries(pairs(reads[i])) })),
    visitorsThisMonth: visitors[DAYS] || 0,
    activeNow: visitors[afterFunnel + MONTHS] || 0,
    funnel: days.slice(-FUNNEL_DAYS).map((day, i) => ({ day, ...Object.fromEntries(STAGES.map((stage, j) => [stage, visitors[DAYS + 1 + i * STAGES.length + j] || 0])) })),
    months: months.map((m, i) => ({ month: m, visitors: visitors[afterFunnel + i] || 0 })),
    boards,
    films: filmRows,
    shares: sharesOf(allMinutes),
    hours,
    channelHours,
    visitHours,
    titles,
    recent,
    playing: playingNow(recent),
  };
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

// What is playing now: each film or channel with a play, a tune-in or a playback report in the
// last 15 minutes, newest first, with how far the latest report had got. Playback reports come
// at pauses and when a page closes, so a long sitting can go quiet between them.
const PLAYING_MS = 15 * 60_000;
export function playingNow(events, now = Date.now()) {
  const seen = new Map();
  for (const { at, name, data } of events) {
    if (!['Play', 'Reached', 'Watched', 'Watched 10 minutes', 'TV'].includes(name) || now - Date.parse(at) > PLAYING_MS) continue;
    const key = data?.film ? `film ${data.film}` : data?.channel ? `channel ${data.channel}` : null;
    if (!key || seen.has(key)) continue; // newest first, so the first seen is the latest word
    seen.set(key, { at, ...(data.film ? { film: data.film } : { channel: data.channel }), ...(name === 'Watched' && { minutes: Math.round(data.total / 60) }), ...(name === 'Reached' && { tenth: data.at }) });
  }
  return [...seen.values()];
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

// Minutes watched by main genre and by decade, beside how many films the site has in each
const SHOWN = Object.values(posterIndex.films).filter(e => e.i && e.p && !e.n);
const decadeOf = year => (year ? `${Math.floor(year / 10) * 10}s` : 'unknown');
export function sharesOf(minutesByFilm, films = posterIndex.films, shown = SHOWN) {
  const tally = (pick) => {
    const out = {};
    for (const e of shown) (out[pick(e)] ||= { minutes: 0, films: 0 }).films++;
    for (const [film, minutes] of minutesByFilm) if (films[film]) (out[pick(films[film])] ||= { minutes: 0, films: 0 }).minutes += minutes;
    return Object.entries(out).map(([label, v]) => ({ label, ...v, minutes: Math.round(v.minutes) })).sort((a, b) => b.minutes - a.minutes || b.films - a.films);
  };
  return { genres: tally(e => e.g?.[0] || 'Other'), decades: tally(e => decadeOf(e.y)) };
}

// Names for films: the poster index first, then the titles events carried (best effort: a
// profile still shows its films by id when the stats database is out)
async function titlesFor(films) {
  const ids = [...new Set(films.filter(Boolean))];
  const titles = Object.fromEntries(ids.map(film => [film, posterIndex.films[film]?.t]).filter(([, title]) => title));
  const rest = ids.filter(film => !titles[film]);
  if (rest.length) {
    const [names] = await redis([['HMGET', 'stats:titles', ...rest]], { readOnly: true }).catch(() => [[]]);
    rest.forEach((film, i) => { if (names[i]) titles[film] = names[i]; });
  }
  return titles;
}

// One page of the event log from `offset`, newest first, with how long the log is
export async function logOf(offset) {
  const [flat, total] = await redis([['LRANGE', 'stats:recent', offset, offset + LOG_PAGE - 1], ['LLEN', 'stats:recent']], { readOnly: true });
  const rows = (flat || []).flatMap(entry => { try { return [JSON.parse(entry)]; } catch { return []; } });
  return { offset, total: Number(total) || 0, rows, titles: await titlesFor(rows.map(event => event.data?.film)) };
}

// Every profile, the most recently changed first, with what each has made. Never the key hash.
export async function profilesOf(db) {
  if (!db) return { profiles: [] };
  const { results } = await db.prepare(`SELECT p.id, p.name, p.handle, p.archive_user, p.hidden, p.created, p.updated,
      (SELECT COUNT(*) FROM channels c WHERE c.profile_id = p.id) channels,
      (SELECT COUNT(*) FROM favourites f WHERE f.profile_id = p.id) hearts,
      (SELECT COUNT(*) FROM channel_saves s WHERE s.profile_id = p.id) saved,
      COALESCE((SELECT MAX(h.at) FROM history h WHERE h.profile_id = p.id), p.updated) last
    FROM profiles p ORDER BY last DESC LIMIT 5000`).all();
  return { profiles: results };
}

// One profile: its favourites (newest first), its channels with their films and notes, and its
// last 200 changes (kind, time, channel and the first 6 characters of the network tag)
export async function profileOf(db, id) {
  if (!db) return { profile: null };
  const [profile, favourites, channels, films, history] = await db.batch([
    db.prepare('SELECT id, name, handle, archive_user, hidden, agreed_at, created, updated FROM profiles WHERE id = ?').bind(id),
    db.prepare('SELECT film_id film, created FROM favourites WHERE profile_id = ? ORDER BY created DESC').bind(id),
    db.prepare('SELECT id, name, description, status, created, updated FROM channels WHERE profile_id = ? ORDER BY created DESC').bind(id),
    db.prepare('SELECT f.channel_id, f.film_id film, f.note FROM channel_films f JOIN channels c ON c.id = f.channel_id WHERE c.profile_id = ? ORDER BY f.channel_id, f.position').bind(id),
    db.prepare("SELECT h.at, h.kind, substr(h.net, 1, 6) net, COALESCE(c.name, json_extract(h.detail, '$.name')) channel FROM history h LEFT JOIN channels c ON c.id = h.channel_id WHERE h.profile_id = ? ORDER BY h.id DESC LIMIT 200").bind(id),
  ]);
  if (!profile.results[0]) return { profile: null };
  const byChannel = {};
  for (const row of films.results) (byChannel[row.channel_id] ||= []).push({ film: row.film, note: row.note });
  const titles = await titlesFor([...favourites.results.map(r => r.film), ...films.results.map(r => r.film)]);
  return {
    profile: profile.results[0],
    favourites: favourites.results,
    channels: channels.results.map(c => ({ ...c, films: byChannel[c.id] || [] })),
    history: history.results,
    titles,
  };
}

// Every search in one month, most asked first; the most asked also say how many visits asked
export async function searchesOf(month) {
  const [flat] = await redis([['ZREVRANGE', `stats:searches:${month}`, 0, -1, 'WITHSCORES']], { readOnly: true });
  const rows = pairs(flat);
  const people = rows.length ? await redis(rows.slice(0, SEARCH_PEOPLE).map(([query]) => ['PFCOUNT', `stats:searchers:${month}:${query}`])) : [];
  return { month, rows: rows.map(([query, count], i) => [query, count, i < SEARCH_PEOPLE ? people[i] || 0 : null]) };
}
