// TMDB API Service for movie poster matching
// Get your API key at: https://www.themoviedb.org/settings/api
import { cleanMovieTitle, selectMovieMatch, titleCandidates, filmYearFromTitle, bestStrictMatch } from './movieMatching.js';
import { indexedMatch } from './posterIndex.js';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const CACHE_STORAGE_KEY = 'tmdb-poster-cache';
export const MAX_CACHE_ENTRIES = 2000;
export const CACHE_VERSION = 3; // bump when matching changes, so cached misses from the old logic are dropped

// Poster sizes: w92, w154, w185, w342, w500, w780, original
export const POSTER_SIZES = {
  small: 'w185',
  medium: 'w342',
  large: 'w500',
  original: 'original'
};

// In-memory cache for TMDB results
let tmdbCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60 * 24 * 7; // 7 days for persistent cache

// Expire entries independently and retain the newest writes when bounded.
function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of tmdbCache) {
    const duration = key === 'genres' ? CACHE_DURATION * 24 : CACHE_DURATION;
    if (!entry || !Number.isFinite(entry.timestamp) || now - entry.timestamp >= duration) {
      tmdbCache.delete(key);
    }
  }
  if (tmdbCache.size > MAX_CACHE_ENTRIES) {
    const oldest = [...tmdbCache].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (const [key] of oldest.slice(0, tmdbCache.size - MAX_CACHE_ENTRIES)) {
      tmdbCache.delete(key);
    }
  }
}

function cacheEntry(key, data) {
  tmdbCache.delete(key);
  tmdbCache.set(key, { data, timestamp: Date.now() });
  pruneCache();
  debouncedSave();
}

// Pending requests tracker to prevent duplicate in-flight requests
const pendingRequests = new Map();

// Rate limiting
let lastRequestTime = 0;
export const MIN_REQUEST_INTERVAL = 25; // ms between requests

// Load cache from localStorage on init
function loadCacheFromStorage() {
  try {
    const stored = localStorage.getItem(CACHE_STORAGE_KEY);
    if (stored) {
      const { version, data } = JSON.parse(stored);
      // Matching changes invalidate old versions; freshness belongs to each entry.
      if (version === CACHE_VERSION && data && typeof data === 'object') {
        tmdbCache = new Map(Object.entries(data));
        pruneCache();
      } else {
        localStorage.removeItem(CACHE_STORAGE_KEY);
      }
    }
  } catch (e) {
    console.warn('Failed to load TMDB cache:', e);
  }
}

// Save cache to localStorage
function saveCacheToStorage() {
  try {
    pruneCache();
    const data = Object.fromEntries(tmdbCache);
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      data
    }));
  } catch (e) {
    // Keep the previous persisted cache if storage is unavailable or full.
    console.warn('Failed to save TMDB cache:', e);
  }
}

// Debounced save to avoid excessive writes
let saveTimeout = null;
function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveCacheToStorage, 2000);
}

// Initialize cache from storage
loadCacheFromStorage();

class TMDBService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.enabled = !!apiKey;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
    this.enabled = !!apiKey;
    // Don't clear cache - poster data is valid regardless of API key
  }

  async throttledFetch(url) {
    const now = Date.now();
    // Reserve the slot before yielding so a batch cannot share one timer.
    const requestTime = Math.max(now, lastRequestTime + MIN_REQUEST_INTERVAL);
    lastRequestTime = requestTime;

    if (requestTime > now) {
      await new Promise(resolve =>
        setTimeout(resolve, requestTime - now)
      );
    }

    return fetch(url);
  }

  getCacheKey(title, year) {
    return `${title.toLowerCase().trim()}-${year || 'unknown'}`;
  }

  getFromCache(title, year) {
    const key = this.getCacheKey(title, year);
    const cached = tmdbCache.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      // Return object with found flag to distinguish "not cached" from "cached but no result"
      return { found: true, data: cached.data };
    }

    return { found: false, data: null };
  }

  setCache(title, year, data) {
    const key = this.getCacheKey(title, year);
    cacheEntry(key, data);
  }

  // Clean movie title for better matching
  cleanTitle(title) {
    return cleanMovieTitle(title);
  }

  // Search for a movie by title and optional year
  async searchMovie(title, year = null, identifier = null) {
    // Decided offline for this Archive.org identifier? Then no TMDB request, and no key needed.
    const indexed = await indexedMatch(identifier);
    if (indexed !== undefined) return indexed;

    if (!this.enabled) return null;

    const cacheKey = this.getCacheKey(title, year);

    // Check cache first - returns { found, data }
    const cached = this.getFromCache(title, year);
    if (cached.found) return cached.data;

    // Check if there's already a pending request for this movie
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }

    // Create the request promise
    const requestPromise = this._fetchFromTMDB(title, year, cacheKey);

    // Store in pending requests
    pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up pending request
      pendingRequests.delete(cacheKey);
    }
  }

  // Internal method to fetch from TMDB API
  async _fetchFromTMDB(title, year, _cacheKey) {
    try {
      // Try the tidied title, then guesses at the real title hidden in it (at most four
      // requests, and only on a miss). The year is not sent: Archive.org years are often
      // the upload year, so same-titled films are told apart by the closest year instead.
      const filmYear = filmYearFromTitle(title) ?? year;
      let bestMatch = null;
      const guesses = [];
      for (const candidate of titleCandidates(title)) {
        const params = new URLSearchParams({
          api_key: this.apiKey,
          query: candidate.query,
          include_adult: false
        });

        const response = await this.throttledFetch(`${TMDB_API_BASE}/search/movie?${params}`);
        if (!response.ok) {
          // Not cached: an outage or rate limit must not hide this film's poster for a week
          console.warn('TMDB search failed:', response.status);
          return null;
        }

        const data = await response.json();
        const match = selectMovieMatch(data.results, candidate.query, filmYear, { strict: candidate.strict });
        if (match && !candidate.strict) {
          bestMatch = match;
          break;
        }
        guesses.push(match);
      }
      bestMatch = bestMatch || bestStrictMatch(guesses, filmYear);

      const result = bestMatch ? {
        id: bestMatch.id,
        title: bestMatch.title,
        posterPath: bestMatch.poster_path,
        backdropPath: bestMatch.backdrop_path,
        releaseDate: bestMatch.release_date,
        overview: bestMatch.overview,
        voteAverage: bestMatch.vote_average,
        genreIds: bestMatch.genre_ids
      } : null;

      this.setCache(title, year, result);
      return result;
    } catch (error) {
      console.error('TMDB search error:', error);
      return null;
    }
  }

  // Get full movie details through the same cache and throttle as searches.
  async getMovieDetails(id) {
    if (!this.enabled) return null;

    const cacheKey = `details:${id}`;
    const cached = tmdbCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }

    const requestPromise = this._fetchMovieDetails(id, cacheKey);
    pendingRequests.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  }

  async _fetchMovieDetails(id, cacheKey) {
    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        append_to_response: 'credits'
      });
      const response = await this.throttledFetch(`${TMDB_API_BASE}/movie/${id}?${params}`);
      if (!response.ok) {
        console.warn('TMDB details failed:', response.status);
        return null;
      }

      const details = await response.json();
      // Persist only what MovieDetailPage displays; full responses can crowd
      // the shared poster cache out of localStorage after a few detail views.
      const fields = [
        'title', 'tagline', 'overview', 'release_date', 'original_language',
        'budget', 'vote_average', 'runtime', 'backdrop_path', 'genres',
      ];
      const data = Object.fromEntries(
        fields.filter(field => field in details).map(field => [field, details[field]])
      );
      const director = details.credits?.crew?.find(person => person.job === 'Director');
      data.credits = {
        cast: details.credits?.cast?.slice(0, 6) || [],
        crew: director ? [director] : [],
      };
      cacheEntry(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Failed to fetch TMDB details:', error);
      return null;
    }
  }

  // Rank one batch of films by TMDB rating, highest first. Every lookup finishes before the
  // batch is ranked, so the order is final when it reaches the screen. Films with no rating
  // (no match, or a failed lookup) follow in the order they came in.
  async sortByRating(movies) {
    const ratings = await Promise.all(movies.map(movie =>
      this.searchMovie(movie.title, movie.year, movie.identifier).then(match => match?.voteAverage || 0, () => 0)));
    return movies
      .map((movie, index) => ({ movie, rating: ratings[index] }))
      .sort((a, b) => b.rating - a.rating)
      .map(entry => entry.movie);
  }

  // Get poster URL
  getPosterUrl(posterPath, size = 'medium') {
    if (!posterPath) return null;
    return `${TMDB_IMAGE_BASE}/${POSTER_SIZES[size] || POSTER_SIZES.medium}${posterPath}`;
  }

  // Get backdrop URL
  getBackdropUrl(backdropPath, size = 'original') {
    if (!backdropPath) return null;
    return `${TMDB_IMAGE_BASE}/${size}${backdropPath}`;
  }

  // Get cast profile URL
  getProfileUrl(profilePath, size = 'w92') {
    if (!profilePath) return null;
    return `${TMDB_IMAGE_BASE}/${size}${profilePath}`;
  }

  // Get TMDB genres mapping
  async getGenres() {
    if (!this.enabled) return {};

    const cached = tmdbCache.get('genres');
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION * 24) {
      return cached.data;
    }

    try {
      const response = await this.throttledFetch(
        `${TMDB_API_BASE}/genre/movie/list?api_key=${this.apiKey}`
      );

      if (!response.ok) return {};

      const data = await response.json();
      const genreMap = {};

      data.genres.forEach(genre => {
        genreMap[genre.id] = genre.name;
      });

      cacheEntry('genres', genreMap);

      return genreMap;
    } catch (error) {
      console.error('Failed to fetch TMDB genres:', error);
      return {};
    }
  }
}

// Export singleton instance
export const tmdbService = new TMDBService(import.meta.env?.VITE_TMDB_API_KEY || '');

export default tmdbService;
