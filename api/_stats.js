// Our own usage counts. This file is the rulebook: which events are accepted and which Redis
// counters each one bumps. It stores counts only: no cookies, no IP addresses, no visitor ids.
// (The leading underscore keeps Vercel from treating this file as an endpoint.)

const FILM = /^[A-Za-z0-9._-]{1,200}$/;
const KEEP_DAYS = 400;
const clean = (value, max = 60) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

// name -> (data) => cleaned data, or null to reject the event
const EVENTS = {
  'Page view': d => ({ path: clean(d.path, 40) || '/', referrer: clean(d.referrer, 60) }),
  'Film opened': d => (FILM.test(d.film) ? { film: d.film } : null),
  'Play': d => (FILM.test(d.film) && ['own', 'archive'].includes(d.player) ? { film: d.film, player: d.player } : null),
  'Watched 10 minutes': d => (FILM.test(d.film) ? { film: d.film } : null),
  'Search': d => ({ query: clean(d.query).toLowerCase(), kind: d.kind === 'pasted link' ? 'pasted link' : 'typed' }),
  'Filter': d => (['genre', 'decade', 'collection', 'sort'].includes(d.type) ? { type: d.type, value: clean(d.value, 40) } : null),
  'Load more': () => ({}),
  'MCP banner': d => (['opened', 'dismissed'].includes(d.action) ? { action: d.action } : null),
};

export function validEvent(body) {
  const check = EVENTS[body?.name];
  if (!check) return null;
  const data = check(body.data && typeof body.data === 'object' ? body.data : {});
  return data && { name: body.name, data };
}

export const isBot = (userAgent) => !userAgent || /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|node-fetch/i.test(userAgent);

// A visitor is counted per day with a HyperLogLog, which keeps an estimate of how many distinct
// values it has seen and none of the values. What goes in is a hash that changes every day.
export async function visitorToken(ip, userAgent, day) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}|${ip}|${userAgent}`));
  return [...new Uint8Array(bytes)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

// The Redis commands for one event. Days and months are UTC.
export function commandsFor({ name, data }, { now = new Date(), visitor } = {}) {
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const commands = [['HINCRBY', `stats:day:${day}`, name, 1]];
  const count = (key, member) => commands.push(['ZINCRBY', `stats:${key}:${month}`, 1, member]);

  if (name === 'Page view') {
    count('pages', data.path);
    if (data.referrer) count('referrers', data.referrer);
    if (visitor) commands.push(['PFADD', `stats:visitors:${day}`, visitor], ['PFADD', `stats:visitors:${month}`, visitor]);
  }
  if (name === 'Film opened') count('opened', data.film);
  if (name === 'Play') { count('played', data.film); count('players', data.player); }
  if (name === 'Watched 10 minutes') count('watched', data.film);
  if (name === 'Search' && data.kind === 'typed' && data.query) count('searches', data.query);
  if (name === 'Filter') count('filters', `${data.type}: ${data.value}`);
  if (name === 'MCP banner') count('banner', data.action);

  for (const key of new Set(commands.map(command => command[1]))) commands.push(['EXPIRE', key, KEEP_DAYS * 86400]);
  return commands;
}
