// Browsing a genre from the poster index instead of Archive.org. Archive.org only knows a film's
// genre when its uploader typed one in, and most did not: it returns 37 comedies from the 1980s
// where the index knows 130. So when a genre is picked the list comes from the index, which every
// visitor already has, and Archive.org's own tagged results follow once the index is exhausted.
import { ALL_FILMS } from './archive.js';

export const PAGE = 24;

// The index can answer when a genre is picked with no search text, across All Films, and the
// sort is one the index knows. Upload dates are not in the index, so "Recently Added" still
// asks Archive.org.
export function browsesIndex({ search, genre, collection, sort }) {
  return Boolean(genre && genre !== 'all' && !String(search || '').trim() && collection === ALL_FILMS && !String(sort).startsWith('publicdate'));
}

const BY = {
  downloads: (a, b) => (b.k || 0) - (a.k || 0), // most popular: most rated on TMDB
  avg_rating: (a, b) => (b.v || 0) - (a.v || 0),
  tmdb_rating: (a, b) => (b.v || 0) - (a.v || 0),
  'date desc': (a, b) => (b.y || 0) - (a.y || 0),
  'date asc': (a, b) => (a.y || 9999) - (b.y || 9999),
  'title asc': (a, b) => a.t.localeCompare(b.t),
};

const toMovie = ([identifier, e]) => ({ identifier, title: e.t, year: e.y, runtimeMinutes: e.l || 0, genres: e.g || [], fromIndex: true });

// Every film of a genre the index knows, one upload per film (the one Jev was surest about),
// filtered like the Archive.org list is and sorted the way the menu says.
// ponytail: filters and sorts the whole index on every page; a few ms for 11k entries. Cache
// per filter set if the index grows past ~50k.
export function indexFilms(index, { genre, decade, shorts = false, minRuntime = 0, sort = 'downloads' }) {
  const best = new Map();
  for (const pair of Object.entries(index)) {
    const e = pair[1];
    if (!e.i || !e.g?.includes(genre)) continue;
    if (decade && !(e.y >= Number(decade) && e.y < Number(decade) + 10)) continue;
    if (shorts ? !(e.l > 0 && e.l <= 30) : e.l > 0 && e.l < minRuntime) continue; // unknown length passes, as on Archive.org
    const kept = best.get(e.i);
    if (!kept || e.c > kept[1].c) best.set(e.i, pair);
  }
  return [...best.values()].sort((a, b) => (BY[sort] || BY.downloads)(a[1], b[1])).map(toMovie);
}

export function pageOf(list, page) {
  const movies = list.slice((page - 1) * PAGE, page * PAGE);
  return { movies, more: page * PAGE < list.length };
}
