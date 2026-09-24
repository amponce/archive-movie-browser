// Our own usage counts. This file is the rulebook: which events are accepted and which Redis
// counters each one bumps. It stores counts only: no cookies, no IP addresses, no visitor ids.
// A visit id (random, one per browser tab) only ever goes into a HyperLogLog for the funnel,
// which keeps an estimate of how many distinct ids it saw and none of the ids.
// (The leading underscore keeps Vercel from treating this file as an endpoint.)

const FILM = /^[A-Za-z0-9._-]{1,200}$/;
const CHANNEL = /^[a-z0-9-]{1,60}$/; // a list slug, or 'mine'
const TARGET = /^[a-z0-9-]{1,40}$/; // a data-track name
const VISIT = /^[a-f0-9]{16}$/;
const MAX_VIEWING = 4 * 3600; // seconds in one report
// Funnel stages a viewing reaches by its running total, in seconds
const WATCHED = [[60, 'watched 1+ min'], [600, 'watched 10+ min'], [1800, 'watched 30+ min']];
const seconds = v => (Number.isInteger(v) && v > 0 ? v : null);
const TV_ACTIONS = ['tune', 'watched 10 minutes', 'watch together', 'from start', 'share my channel', 'add to my channel', 'remove from my channel'];
const KEEP_DAYS = 400;
const RECENT = 50;
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const clean = (value, max = 60) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

// name -> (data) => cleaned data, or null to reject the event
const EVENTS = {
  'Page view': d => ({ path: clean(d.path, 40) || '/', referrer: clean(d.referrer, 60) }),
  'Film opened': d => (FILM.test(d.film) ? { film: d.film, ...(clean(d.title, 80) && { title: clean(d.title, 80) }) } : null),
  'Play': d => (FILM.test(d.film) && ['own', 'archive'].includes(d.player) ? { film: d.film, player: d.player } : null),
  'Watched 10 minutes': d => (FILM.test(d.film) ? { film: d.film } : null),
  'Search': d => ({ query: clean(d.query).toLowerCase(), kind: d.kind === 'pasted link' ? 'pasted link' : 'typed' }),
  'Filter': d => (['genre', 'decade', 'collection', 'sort'].includes(d.type) ? { type: d.type, value: clean(d.value, 40) } : null),
  'Load more': () => ({}),
  // What people do with television. channel and film are optional, but checked when present.
  'TV': d => {
    if (!TV_ACTIONS.includes(d.action)) return null;
    if (d.channel !== undefined && !CHANNEL.test(d.channel)) return null;
    if (d.film !== undefined && !FILM.test(d.film)) return null;
    return { action: d.action, ...(d.channel && { channel: d.channel }), ...(d.film && { film: d.film }) };
  },
  // Something with a data-track attribute was clicked
  'Click': d => (TARGET.test(d.target) && (d.film === undefined || FILM.test(d.film)) ? { target: d.target, ...(d.film && { film: d.film }) } : null),
  // Seconds of actual playback since the last report, and the running total of this viewing
  'Watched': d => {
    const played = seconds(d.seconds);
    if (!['film', 'tv'].includes(d.where) || !played || played > MAX_VIEWING) return null;
    if (d.film !== undefined && !FILM.test(d.film)) return null;
    if (d.channel !== undefined && !CHANNEL.test(d.channel)) return null;
    return { where: d.where, seconds: played, total: Math.max(played, seconds(d.total) || 0), ...(d.film && { film: d.film }), ...(d.channel && { channel: d.channel }) };
  },
  'MCP banner': d => (['opened', 'dismissed'].includes(d.action) ? { action: d.action } : null),
};

export function validEvent(body) {
  const check = EVENTS[body?.name];
  if (!check) return null;
  const data = check(body.data && typeof body.data === 'object' ? body.data : {});
  return data && { name: body.name, data, ...(VISIT.test(body.visit) && { visit: body.visit }) };
}

// The funnel stages an event puts its visit in
function stagesOf({ name, data }) {
  if (name === 'Page view') return ['visited'];
  if (name === 'Click') return ['clicked'];
  // A film pressed play; tuning in to a channel is its own stage: you join mid-film and surf, so
  // counting it as a play made films look abandoned
  if (name === 'Play') return ['played'];
  if (name === 'TV' && data.action === 'tune') return ['tuned in'];
  if (name === 'Watched') return WATCHED.filter(([at]) => data.total >= at).map(([, stage]) => stage);
  return [];
}

export const isBot = (userAgent) => !userAgent || /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|node-fetch/i.test(userAgent);

// A visitor is counted per day with a HyperLogLog, which keeps an estimate of how many distinct
// values it has seen and none of the values. What goes in is a hash that changes every day.
export async function visitorToken(ip, userAgent, day) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}|${ip}|${userAgent}`));
  return [...new Uint8Array(bytes)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

// The Redis commands for one event. Days and months are UTC.
export function commandsFor({ name, data, visit }, { now = new Date(), visitor } = {}) {
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const commands = [['HINCRBY', `stats:day:${day}`, name, 1]];
  const count = (key, member) => commands.push(['ZINCRBY', `stats:${key}:${month}`, 1, member]);

  if (name === 'Page view') {
    count('pages', data.path);
    if (data.referrer) count('referrers', data.referrer);
    if (visitor) commands.push(['PFADD', `stats:visitors:${day}`, visitor], ['PFADD', `stats:visitors:${month}`, visitor]);
  }
  if (name === 'Film opened') {
    count('opened', data.film);
    // Boards are keyed by identifier (titles are not unique); the name is kept beside them
    if (data.title) commands.push(['HSET', 'stats:titles', data.film, data.title]);
  }
  if (name === 'Play') { count('played', data.film); count('players', data.player); }
  if (name === 'Watched 10 minutes') count('watched', data.film);
  if (name === 'Search' && data.kind === 'typed' && data.query) count('searches', data.query);
  if (name === 'Filter') count('filters', `${data.type}: ${data.value}`);
  if (name === 'MCP banner') count('banner', data.action);
  if (name === 'Click') count('clicks', data.target);
  if (name === 'Watched') {
    const minutes = Math.round((data.seconds / 60) * 100) / 100;
    commands.push(['HINCRBY', `stats:day:${day}`, 'Seconds watched', data.seconds]);
    if (data.film) commands.push(['ZINCRBY', `stats:minutes:${month}`, minutes, data.film]);
    if (data.channel) commands.push(['ZINCRBY', `stats:channel-minutes:${month}`, minutes, data.channel]);
  }
  if (visit) for (const stage of stagesOf({ name, data })) commands.push(['PFADD', `stats:funnel:${stage}:${day}`, visit]);
  // Per channel: how often it was tuned to, and how often someone stayed ten minutes
  if (name === 'TV') {
    count('tv', data.action);
    if (data.channel && data.action === 'tune') count('tuned', data.channel);
    if (data.channel && data.action === 'watched 10 minutes') count('stayed', data.channel);
  }

  // The latest events, newest first: what happened and when, never who. It answers "I just
  // opened a film, did it count?" without waiting for a leaderboard to move.
  commands.push(['LPUSH', 'stats:recent', JSON.stringify({ at: now.toISOString(), name, data })], ['LTRIM', 'stats:recent', 0, RECENT - 1]);

  for (const key of new Set(commands.map(command => command[1]))) commands.push(['EXPIRE', key, KEEP_DAYS * 86400]);
  return commands;
}
