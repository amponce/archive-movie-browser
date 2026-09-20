// TMDB API Service for movie poster matching
// Get your API key at: https://www.themoviedb.org/settings/api

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const CACHE_STORAGE_KEY = 'tmdb-poster-cache';
const CACHE_VERSION = 1;

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

// Pending requests tracker to prevent duplicate in-flight requests
const pendingRequests = new Map();

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // ms between requests

// Load cache from localStorage on init
function loadCacheFromStorage() {
  try {
    const stored = localStorage.getItem(CACHE_STORAGE_KEY);
    if (stored) {
      const { version, data, timestamp } = JSON.parse(stored);
      // Check version and if cache is still valid (7 days)
      if (version === CACHE_VERSION && Date.now() - timestamp < CACHE_DURATION) {
        tmdbCache = new Map(Object.entries(data));
        console.log(`Loaded ${tmdbCache.size} cached TMDB entries`);
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
    const data = Object.fromEntries(tmdbCache);
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data
    }));
  } catch (e) {
    // localStorage might be full, clear old entries
    console.warn('Failed to save TMDB cache:', e);
    try {
      localStorage.removeItem(CACHE_STORAGE_KEY);
    } catch {}
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
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve =>
        setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }

    lastRequestTime = Date.now();
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
    tmdbCache.set(key, {
      data,
      timestamp: Date.now()
    });
    // Save to localStorage (debounced)
    debouncedSave();
  }

  // Clean movie title for better matching
  cleanTitle(title) {
    return title
      .replace(/\s*\(\d{4}\)\s*$/, '') // Remove year in parentheses
      .replace(/\s*\[\d{4}\]\s*$/, '') // Remove year in brackets
      .replace(/\s*-\s*\d{4}\s*$/, '') // Remove year after dash
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  // Search for a movie by title and optional year
  async searchMovie(title, year = null) {
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
  async _fetchFromTMDB(title, year, cacheKey) {
    try {
      const cleanedTitle = this.cleanTitle(title);
      const params = new URLSearchParams({
        api_key: this.apiKey,
        query: cleanedTitle,
        include_adult: false
      });

      if (year) {
        params.append('year', year);
      }

      const response = await this.throttledFetch(
        `${TMDB_API_BASE}/search/movie?${params}`
      );

      if (!response.ok) {
        console.warn('TMDB search failed:', response.status);
        this.setCache(title, year, null);
        return null;
      }

      const data = await response.json();

      // Find best match
      let bestMatch = null;

      if (data.results && data.results.length > 0) {
        // Try to find exact or close title match
        bestMatch = data.results.find(movie => {
          const movieTitle = movie.title.toLowerCase();
          const searchTitle = cleanedTitle.toLowerCase();
          return movieTitle === searchTitle ||
                 movieTitle.includes(searchTitle) ||
                 searchTitle.includes(movieTitle);
        });

        // If no good match, use first result if it has a poster
        if (!bestMatch && data.results[0].poster_path) {
          bestMatch = data.results[0];
        }
      }

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
      this.setCache(title, year, null);
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
      tmdbCache.set(cacheKey, { data, timestamp: Date.now() });
      debouncedSave();
      return data;
    } catch (error) {
      console.error('Failed to fetch TMDB details:', error);
      return null;
    }
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

      tmdbCache.set('genres', {
        data: genreMap,
        timestamp: Date.now()
      });

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
