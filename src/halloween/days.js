// 31 Days of Horror: one film a night through October, opened day by day in Pacific time (the
// site's own day, as on /stats). Pure functions: the clock is always passed in.
import data from './31-days.json' with { type: 'json' };

export const DAYS = data.days;
export const FILMS = DAYS.map(d => d.film);
export const isHalloweenFilm = film => FILMS.includes(film);
const MONTH = `${data.year}-10`;

const PACIFIC = new Intl.DateTimeFormat('en-CA', { timeZone: data.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
export const pacificDay = (now = new Date()) => PACIFIC.format(now);

// How many days have opened: none before October 1, all of them from November 1
export function openedDays(now) {
  const day = pacificDay(now);
  if (day < `${MONTH}-01`) return 0;
  if (day.slice(0, 7) > MONTH) return DAYS.length;
  return Number(day.slice(8));
}

// Tonight's film, from October 1 to 31; null outside October
export const tonight = now => (pacificDay(now).startsWith(MONTH) ? DAYS[openedDays(now) - 1] : null);
export const inOctober = now => pacificDay(now).startsWith(MONTH);
// From October 31 the page is the scoreboard
export const isFinale = now => pacificDay(now) >= `${MONTH}-31`;
export const isFinaleDay = now => pacificDay(now) === `${MONTH}-31`;

// The days by how many people have seen their film, most first; the calendar's order breaks ties
export const ranked = (seen = {}) => [...DAYS].sort((a, b) => (seen[b.film] || 0) - (seen[a.film] || 0) || a.day - b.day);

// The crowd's share is shown once enough people have ticked anything, so one tick is not 100%
export const CROWD_MIN = 5;
export function crowdShare(crowd, film) {
  const { seen = {}, people = 0 } = crowd || {};
  return people >= CROWD_MIN ? Math.min(100, Math.round(((seen[film] || 0) / people) * 100)) : null;
}

// The banner's dismissal lasts the day, so tomorrow's film shows again
export const bannerKey = now => `halloween-banner-dismissed-${pacificDay(now)}`;

// The films this browser has ticked. Not part of a profile.
export const SEEN_KEY = `halloween-${data.year}-seen`;
export function loadSeen(storage) {
  try {
    const ids = JSON.parse((storage || globalThis.localStorage).getItem(SEEN_KEY) || '[]');
    return Array.isArray(ids) ? ids.filter(isHalloweenFilm) : [];
  } catch { return []; }
}
// `seen`: the list as the page holds it, which is all there is when storage is off
export function toggleSeen(seen, film, storage) {
  const next = seen.includes(film) ? seen.filter(id => id !== film) : [...seen, film];
  try { (storage || globalThis.localStorage).setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* private mode: kept for this page only */ }
  return next;
}
