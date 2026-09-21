// Filter state that belongs in the URL, so views are shareable and Back works (#43).
// These helpers are pure: the component passes location.search in and writes the query out.
import { STANDARD_GENRES, VIDEO_CATEGORIES, DECADES, ALL_FILMS, defaultMinRuntime, collectionChoice } from './archive.js';

export const SORT_OPTIONS = {
  downloads: 'Most Popular',
  avg_rating: 'Top Rated (Archive)',
  tmdb_rating: 'Top Rated (TMDB)',
  'date desc': 'Release Date (Newest)',
  'date asc': 'Release Date (Oldest)',
  'publicdate desc': 'Recently Added',
  'publicdate asc': 'Oldest Added',
  'title asc': 'Title A-Z',
};

// Defaults are omitted from the query string, so the plain URL stays clean.
export const URL_FILTER_DEFAULTS = {
  collection: ALL_FILMS,
  genre: 'all',
  q: '',
  sort: 'downloads',
  decade: null,
  runtime: 40,
  type: 'features',
};

// Read a query string and validate everything: unknown sort values, non-numeric
// runtimes and genres/collections outside the known lists all fall back to their
// defaults, so a hand-edited URL can't crash or blank the page.
export function parseFilters(search) {
  const params = new URLSearchParams(search || '');
  const filters = {};

  const collection = params.get('collection');
  if (collection && (collection === ALL_FILMS || VIDEO_CATEGORIES.some(c => c.id === collection))) {
    // A genre-named collection (links from before genres moved to the pills) becomes its pill
    const choice = collectionChoice(collection);
    filters.collection = choice.collection;
    if (choice.genre) filters.genre = choice.genre;
  }

  const genre = params.get('genre');
  if (genre && (genre === 'all' || STANDARD_GENRES.includes(genre))) {
    filters.genre = genre;
  }

  const q = params.get('q');
  if (q) filters.q = q;

  const decade = Number(params.get('decade'));
  if (DECADES.includes(decade)) filters.decade = decade;

  const sort = params.get('sort');
  if (sort && Object.prototype.hasOwnProperty.call(SORT_OPTIONS, sort)) {
    filters.sort = sort;
  }

  const runtime = params.get('runtime');
  if (runtime && Number.isFinite(Number(runtime))) {
    const minutes = Number(runtime);
    if (minutes >= 0 && minutes <= 300) filters.runtime = minutes;
  }

  if (params.get('type') === 'trailers') filters.type = 'trailers';

  const restored = { ...URL_FILTER_DEFAULTS, ...filters };
  // Runtime defaults follow the collection, like the category handler does:
  // shorts-oriented collections start unfiltered, trailers at 0.
  if (!('runtime' in filters)) {
    restored.runtime = restored.type === 'trailers'
      ? 0
      : defaultMinRuntime(restored.collection);
  }
  return restored;
}

// Rebuild the query string from filter state, omitting values that match the
// defaults for this collection and content type.
export function filtersToQuery(filters = {}) {
  const collection = filters.collection ?? URL_FILTER_DEFAULTS.collection;
  const genre = filters.genre ?? URL_FILTER_DEFAULTS.genre;
  const q = filters.q ?? URL_FILTER_DEFAULTS.q;
  const decade = filters.decade ?? URL_FILTER_DEFAULTS.decade;
  const sort = filters.sort ?? URL_FILTER_DEFAULTS.sort;
  const type = filters.type ?? URL_FILTER_DEFAULTS.type;
  const minRuntime = filters.runtime;

  const params = new URLSearchParams();
  if (collection !== URL_FILTER_DEFAULTS.collection) params.set('collection', collection);
  if (genre !== URL_FILTER_DEFAULTS.genre) params.set('genre', genre);
  if (q) params.set('q', q);
  if (decade) params.set('decade', String(decade));
  if (sort !== URL_FILTER_DEFAULTS.sort) params.set('sort', sort);
  const defaultRuntime = type === 'trailers' ? 0 : defaultMinRuntime(collection);
  if ((minRuntime ?? defaultRuntime) !== defaultRuntime) params.set('runtime', String(minRuntime));
  if (type !== URL_FILTER_DEFAULTS.type) params.set('type', type);

  return params.toString();
}
