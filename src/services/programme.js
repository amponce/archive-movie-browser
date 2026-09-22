// The landing page as a programme: what to feature and which films fill each row, decided
// from the poster index alone so the page needs no request before someone opens a film.
// Takes the index's `films` map: identifier -> { i, t, y, p, v, c } or { n: 1, c }.

const usable = ([, entry]) => entry.i && entry.p && entry.c >= 0.8;
const film = ([id, entry]) => ({ id, entry });

function seededShuffle(items, seed) {
  let s = seed >>> 0 || 1;
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const dayOf = now => Math.floor(now.getTime() / 86400000);

// Tonight's film. Hand-picked (src/programme/featured.json): one a day in order, round and round,
// skipping any pick the index cannot show. Only if the picks run dry: a confident, well-rated
// film with a poster, the same for everyone all day.
export function featuredFor(index, now = new Date(), picks = []) {
  const showable = picks.filter(pick => index[pick.id]?.p);
  if (showable.length) {
    const pick = showable[dayOf(now) % showable.length];
    return { id: pick.id, entry: index[pick.id], why: pick.why };
  }
  const candidates = Object.entries(index).filter(usable).filter(([, e]) => (e.v || 0) >= 7).map(film);
  if (!candidates.length) return null;
  return seededShuffle(candidates, dayOf(now))[0];
}

// Time until the featured film changes (UTC midnight), as "09h 14m"
export function changesIn(now = new Date()) {
  const minutes = Math.max(0, Math.ceil((86400000 - (now.getTime() % 86400000)) / 60000));
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}h ${String(minutes % 60).padStart(2, '0')}m`;
}

// A row: films the index knows well, best rated first
export function rowFor(index, { decade, limit = 12 } = {}) {
  return Object.entries(index)
    .filter(usable)
    .filter(([, e]) => !decade || (e.y >= decade && e.y < decade + 10))
    .sort((a, b) => (b[1].v || 0) - (a[1].v || 0))
    .slice(0, limit)
    .map(film);
}

// Today's shelf: one decade a day, six well-regarded films from it in a fixed daily order.
// ponytail: 'well-regarded' is TMDB's average with no vote-count floor, so a film with three
// votes can rate 9; store vote counts in the index and require, say, 50.
// A decade with too few films to fill a shelf never comes up, and nothing after the 1970s: the
// front desk is for films old enough to have been forgotten.
export function shelfFor(index, now = new Date(), limit = 6, lastDecade = 1970) {
  const usableFilms = Object.entries(index).filter(usable).filter(([, e]) => (e.v || 0) >= 6.5).map(film);
  const byDecade = new Map();
  for (const f of usableFilms) {
    const decade = Math.floor((f.entry.y || 0) / 10) * 10;
    if (decade >= 1900 && decade <= lastDecade) byDecade.set(decade, [...(byDecade.get(decade) || []), f]);
  }
  const decades = [...byDecade.keys()].filter(d => byDecade.get(d).length >= limit).sort();
  if (!decades.length) return null;
  const decade = decades[dayOf(now) % decades.length];
  return { decade, films: seededShuffle(byDecade.get(decade), dayOf(now) + decade).slice(0, limit) };
}

// The tonight question: feature films you can finish in an evening, 40 to 90 minutes, well
// regarded, a different dozen each day. Needs `l` (length) from the backfill.
export function shortRow(index, now = new Date(), limit = 12) {
  const fits = Object.entries(index).filter(usable).filter(([, e]) => e.l >= 40 && e.l <= 90 && (e.v || 0) >= 6.5).map(film);
  return seededShuffle(fits, dayOf(now) + 11).slice(0, limit);
}

// Films on the same shelf as one film, from the index alone: share a genre, prefer the same
// decade, then the nearest ones, well regarded first. Null when the film is not in the index
// or has no genre there, so the caller can ask Archive.org instead.
export function sameShelf(index, identifier, limit = 12) {
  const me = index[identifier];
  if (!me?.g?.length) return null;
  const decade = Math.floor((me.y || 0) / 10) * 10;
  const score = e => {
    const shared = e.g.filter(g => me.g.includes(g)).length;
    const gap = Math.abs(Math.floor((e.y || 0) / 10) * 10 - decade) / 10;
    return shared * 10 - gap * 2 + Math.min(e.v || 0, 8);
  };
  const seen = new Set([me.i]);
  return Object.entries(index)
    .filter(usable)
    .filter(([id, e]) => id !== identifier && e.g?.some(g => me.g.includes(g)) && (e.v || 0) >= 5.5)
    .filter(([, e]) => !seen.has(e.i) && seen.add(e.i)) // one card per film
    .sort((a, b) => score(b[1]) - score(a[1]))
    .slice(0, limit)
    .map(film);
}

// Posters to tile faintly behind the hero: a different set each day, all real
export function wallFor(index, limit = 40, now = new Date()) {
  return seededShuffle(Object.entries(index).filter(usable).map(film), dayOf(now) + 3).slice(0, limit);
}

// Films the index decided have no poster anywhere: a different handful each day
export function wantedFrom(index, limit = 5, now = new Date()) {
  const none = Object.keys(index).filter(id => index[id].n);
  return seededShuffle(none, dayOf(now) + 7).slice(0, limit);
}

// The real numbers for the stats strip
export function countsOf(index) {
  const entries = Object.values(index);
  const identified = entries.filter(e => e.i).length;
  const posters = entries.filter(e => e.p).length;
  return { identified, posters, wanted: entries.length - identified };
}
