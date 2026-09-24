// Browsing a genre from the poster index instead of Archive.org. Archive.org only knows a film's
// genre when its uploader typed one in, and most did not: it returns 37 comedies from the 1980s
// where the index knows 130. So when a genre is picked the list comes from the index, which every
// visitor already has, and Archive.org's own tagged results follow once the index is exhausted.
import { ALL_FILMS, byAudience } from './archive.js';
import { cartoonOutOfPlace } from './posterIndex.js';

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

// `d` is how long the upload runs; `l` is how long the film runs. A trailer of The Shining has
// d = 1 and l = 144, so the card and the length filter use d, and 0 (unmeasured) passes as an
// unknown length does on Archive.org.
const toMovie = ([identifier, e]) => ({ identifier, title: e.t, year: e.y, runtimeMinutes: e.d || 0, genres: e.g || [], fromIndex: true });

// Uploads that say what they are in their name, for the ones not measured yet
const CLIP = /trailer|teaser|turner_video|tv[-_]?spot/i;
// A feature-length upload: measured at 40 minutes or more, or unmeasured and not named as a clip
export const isFeature = ([id, e]) => (e.d > 0 ? e.d >= 40 : !CLIP.test(id));
// Of two uploads of one film, the full-length one, then the one Archive.org's visitors chose
// (f: favourites, bad: panned by reviewers; scripts/backfill-favourites.mjs), then the one Jev
// was surest about
const audience = e => ({ favorites: e.f, panned: !!e.bad });
export const betterUpload = (a, b) => (isFeature(b) - isFeature(a)) || -byAudience(audience(a[1]), audience(b[1])) || (b[1].c - a[1].c);

// Every film of a genre the index knows, one upload per film, filtered like the Archive.org
// list is and sorted the way the menu says.
// ponytail: filters and sorts the whole index on every page; a few ms for 11k entries. Cache
// per filter set if the index grows past ~50k.
export function indexFilms(index, { genre, decade, shorts = false, minRuntime = 0, sort = 'downloads' }) {
  const best = new Map();
  for (const pair of Object.entries(index)) {
    const e = pair[1];
    if (!e.i || !e.g?.includes(genre) || cartoonOutOfPlace(e.g, genre)) continue;
    if (decade && !(e.y >= Number(decade) && e.y < Number(decade) + 10)) continue;
    if (shorts ? isFeature(pair) || e.d > 30 : (e.d > 0 ? e.d < minRuntime : !isFeature(pair))) continue;
    const kept = best.get(e.i);
    if (!kept || betterUpload(pair, kept) < 0) best.set(e.i, pair);
  }
  return [...best.values()].sort((a, b) => (BY[sort] || BY.downloads)(a[1], b[1])).map(toMovie);
}

export function pageOf(list, page) {
  const movies = list.slice((page - 1) * PAGE, page * PAGE);
  return { movies, more: page * PAGE < list.length };
}
