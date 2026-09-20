// Archive.org API Service

const ARCHIVE_API = 'https://archive.org/advancedsearch.php';
const ARCHIVE_METADATA_API = 'https://archive.org/metadata';

// Video categories/collections available on Archive.org
// Collection IDs are case-sensitive and must match exactly
// `features: true` marks collections of feature-length films, which default to a 40+ minute
// filter. Everything else is mostly shorts or has no runtime recorded, so it defaults to any length.
export const VIDEO_CATEGORIES = [
  { id: 'feature_films', features: true, name: 'Feature Films', description: 'Classic feature-length movies' },
  { id: 'moviesandfilms', features: true, name: 'Movies & Films', description: 'Full-length films from the Archive' },
  { id: 'Film_Noir', features: true, name: 'Film Noir', description: 'Dark crime dramas and thrillers' },
  { id: 'SciFi_Horror', features: true, name: 'Sci-Fi & Horror', description: 'Science fiction and horror films' },
  { id: 'silent_films', name: 'Silent Films', description: 'Silent era classics' },
  { id: 'animationandcartoons', name: 'Animation & Cartoons', description: 'Animated films and shorts' },
  { id: 'television', name: 'Television', description: 'TV shows and broadcasts' },
  { id: 'prelinger', name: 'Prelinger Archives', description: 'Educational and ephemeral films' },
  { id: 'opensource_movies', name: 'Community Video', description: 'Community contributed films' },
  { id: 'artsandmusicvideos', name: 'Arts & Music', description: 'Music videos and art films' },
  { id: 'computersandtechvideos', name: 'Tech Videos', description: 'Technology and computer content' },
  { id: 'newsandpublicaffairs', name: 'News & Public Affairs', description: 'News broadcasts and documentaries' },
  { id: 'spiritualityandreligion', name: 'Spirituality & Religion', description: 'Religious and spiritual content' },
  { id: 'sports', name: 'Sports Videos', description: 'Sports footage and broadcasts' },
  { id: 'gamevideos', name: 'Video Games', description: 'Video game related content' },
  { id: 'vlogs', name: 'Vlogs', description: 'Video blogs and personal content' },
  { id: 'youth_media', name: 'Youth Media', description: 'Content created by youth' }
];

// Minimum runtime (minutes) a collection should start with
export function defaultMinRuntime(collectionId) {
  return VIDEO_CATEGORIES.find(c => c.id === collectionId)?.features ? 40 : 0;
}

// Predicate for the Full Movies / Shorts toggle. Many Archive.org items have no runtime
// recorded, which is not evidence of a short, so only a known runtime can exclude a film.
export function runtimeFilter({ shorts = false, minRuntime = 0 } = {}) {
  return (movie) =>
    movie.runtimeMinutes === 0 ||
    (shorts ? movie.runtimeMinutes <= 30 : movie.runtimeMinutes >= minRuntime);
}

// Content filter - block inappropriate content
function isBlockedContent(movie) {
  if (!movie) return true;

  // Handle title being string or array
  const title = Array.isArray(movie.title) ? movie.title[0] : movie.title;
  const titleLower = String(title || '').toLowerCase();
  const identifierLower = String(movie.identifier || '').toLowerCase();

  // Block content with problematic patterns
  if (titleLower.includes('the child') || identifierLower.includes('thechild')) {
    return true;
  }

  return false;
}

// Standard movie genre categories for normalization
export const STANDARD_GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'Film Noir',
  'History',
  'Horror',
  'Music',
  'Musical',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Short',
  'Sport',
  'Thriller',
  'War',
  'Western'
];

// Genre mapping for normalization
const GENRE_ALIASES = {
  'science fiction': 'Sci-Fi',
  'scifi': 'Sci-Fi',
  'sf': 'Sci-Fi',
  'sci fi': 'Sci-Fi',
  'noir': 'Film Noir',
  'black and white': null, // Not a genre
  'b&w': null,
  'silent': null,
  'silent film': null,
  'public domain': null,
  'feature': null,
  'feature film': null,
  'feature films': null,
  'movies': null,
  'movie': null,
  'film': null,
  'classic': null,
  'classics': null,
  'vintage': null,
  'old movies': null,
  'romantic comedy': 'Romance',
  'rom-com': 'Romance',
  'romcom': 'Romance',
  'action adventure': 'Action',
  'action/adventure': 'Action',
  'suspense': 'Thriller',
  'psychological thriller': 'Thriller',
  'historical': 'History',
  'historical drama': 'History',
  'biographical': 'History',
  'biography': 'History',
  'biopic': 'History',
  'war film': 'War',
  'world war': 'War',
  'wwii': 'War',
  'ww2': 'War',
  'cartoon': 'Animation',
  'animated': 'Animation',
  'childrens': 'Family',
  "children's": 'Family',
  'kids': 'Family',
  'musical comedy': 'Musical',
  'drama/romance': 'Drama',
  'crime drama': 'Crime',
  'detective': 'Crime',
  'gangster': 'Crime',
  'horror/thriller': 'Horror',
  'scary': 'Horror',
  'monster': 'Horror',
  'sports': 'Sport',
  'sports drama': 'Sport'
};

// Words that tell re-uploads of one film apart, not different films
const UPLOAD_NOISE = /\b(\d{3,4}p|4k|\d+fps|\d+kb|full hd|hd|uhd|blu ?ray|bdrip|brrip|dvdrip|dvd|mpeg\d?|mp4|avi|mkv|full movie|widescreen|colou?rized|restored|remastered|video quality|quality|upgrade|uncut)\b/g;
const FILM_YEAR = /\b(18|19|20)\d{2}\b/g;

class ArchiveService {
  normalizeMovie(movie) {
    const runtimeMinutes = this.parseRuntime(movie.runtime);
    const genres = this.extractGenres(movie.subject);
    const title = Array.isArray(movie.title) ? movie.title[0] : movie.title;

    return {
      id: movie.identifier,
      identifier: movie.identifier,
      title: title || movie.identifier,
      year: movie.year ? parseInt(movie.year, 10) : null,
      runtimeMinutes,
      runtime: movie.runtime,
      genres: genres.length > 0 ? genres : ['Uncategorized'],
      downloads: movie.downloads || 0,
      rating: movie.avg_rating || null,
      description: movie.description,
      creator: Array.isArray(movie.creator) ? movie.creator[0] : movie.creator,
      archiveUrl: `https://archive.org/details/${movie.identifier}`,
      thumbnailUrl: `https://archive.org/services/img/${movie.identifier}`,
      embedUrl: `https://archive.org/embed/${movie.identifier}`,
      date: movie.date || movie.publicdate,
      publicDate: movie.publicdate
    };
  }

  // Key that is equal for re-uploads of one film:
  // "Title", "The Title-hd", "title_512kb", "Title (1959) [1080p Blu-Ray]"
  dedupeKey(title) {
    const lower = String(title).toLowerCase();
    const key = lower
      .replace(/[([][^)\]]*[)\]]/g, ' ') // bracketed notes
      .replace(/[^\p{L}\p{N}]+/gu, ' ') // punctuation and underscores
      .replace(UPLOAD_NOISE, ' ')
      .replace(FILM_YEAR, ' ')
      .replace(/\b(the|a|an)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return key || lower.trim(); // titles like "1984" are nothing but a year
  }

  // Parse runtime (in minutes) from the many formats uploaders use:
  // "1:17:26", "20:33", "89 min.", "1h 25m", "01:10'31", "1:33.13", "28 min 32 sec"
  parseRuntime(runtime) {
    if (!runtime) return 0;
    const runtimeStr = String(runtime);
    const nums = (runtimeStr.match(/\d+/g) || []).map(Number);
    if (nums.length === 0) return 0;

    // "1h 25m", "2h"
    if (/\d\s*h/i.test(runtimeStr)) {
      return nums[0] * 60 + (nums[1] || 0);
    }
    // Three or more numbers are H:M:S whatever the separators; two are M:S; one is minutes
    if (nums.length >= 3) return nums[0] * 60 + nums[1] + nums[2] / 60;
    if (nums.length === 2) return nums[0] + nums[1] / 60;
    return nums[0];
  }

  // Normalize genre to standard categories
  normalizeGenre(genre) {
    if (!genre) return null;

    const lowerGenre = genre.toLowerCase().trim();

    // Check aliases first
    if (lowerGenre in GENRE_ALIASES) {
      return GENRE_ALIASES[lowerGenre];
    }

    // Check if it matches a standard genre
    const standardMatch = STANDARD_GENRES.find(
      g => g.toLowerCase() === lowerGenre
    );
    if (standardMatch) return standardMatch;

    // Check if it contains a standard genre
    for (const std of STANDARD_GENRES) {
      if (lowerGenre.includes(std.toLowerCase())) {
        return std;
      }
    }

    // Return null for non-genre subjects
    if (lowerGenre.length > 30) return null;
    if (/^\d+$/.test(lowerGenre)) return null;
    if (/^[a-z]$/.test(lowerGenre)) return null;

    return null; // Don't include unrecognized genres
  }

  // Extract and normalize genres from Archive.org subjects
  extractGenres(subject) {
    if (!subject) return [];

    const subjects = Array.isArray(subject) ? subject : [subject];
    const genres = new Set();

    subjects.forEach(s => {
      // Split by common delimiters
      String(s).split(/[;,\/]/).forEach(part => {
        const normalized = this.normalizeGenre(part.trim());
        if (normalized) {
          genres.add(normalized);
        }
      });
    });

    return Array.from(genres).sort();
  }

  // Split user input into plain lowercase words (null if there are none).
  // Lowercased so typed "AND"/"OR" are plain words, not operators.
  searchWords(searchQuery) {
    return String(searchQuery || '').toLowerCase().match(/[\p{L}\p{N}]+/gu);
  }

  // Build search query
  buildQuery(options = {}) {
    const {
      searchQuery = '',
      collection = 'moviesandfilms',
      minRuntime = null,
      year = null,
      genre = null
    } = options;

    // Just filter by collection - the collection itself defines content type
    // Adding mediatype filter is too restrictive for many collections
    let query = `collection:"${collection}"`;

    // Match every search word (a phrase match finds nothing for "night living").
    // Only letters and digits survive - Archive.org's backend errors on escaped quotes.
    const words = this.searchWords(searchQuery);
    if (words) {
      // A search looks in every collection the app offers, not just the selected one
      query = `collection:(${VIDEO_CATEGORIES.map(c => c.id).join(' OR ')})`;
      // Search in title, subject, and creator
      const all = `(${words.join(' AND ')})`;
      query += ` AND (title:${all} OR subject:${all} OR creator:${all})`;
    }

    // Add genre filter to query for better results
    if (genre && genre !== 'all') {
      // Include aliases so the server matches what normalizeGenre() maps to this genre
      const names = [genre, ...Object.keys(GENRE_ALIASES).filter(alias => GENRE_ALIASES[alias] === genre)];
      query += ` AND subject:(${names.map(n => `"${n}"`).join(' OR ')})`;
    }

    if (year) {
      query += ` AND year:${year}`;
    }

    // Collections contain sub-collections ("Silent Films", "Vintage Cartoons"), which are
    // folders, not videos. A mediatype:movies filter would be too strict for some collections.
    query += ' AND NOT mediatype:collection';

    return query;
  }

  // Fetch movies from Archive.org
  async fetchMovies(options = {}) {
    const {
      searchQuery = '',
      sortBy = 'downloads',
      sortOrder = 'desc',
      page = 1,
      rowsPerPage = 200,
      minRuntime = 0,
      genre = null,
      collection = 'moviesandfilms',
      retryDelayMs = 600
    } = options;

    const query = this.buildQuery({ searchQuery, genre, collection });

    const fields = [
      'identifier',
      'title',
      'subject',
      'runtime',
      'year',
      'downloads',
      'description',
      'creator',
      'avg_rating',
      'date',
      'publicdate'
    ];

    const fieldParams = fields.map(f => `fl[]=${f}`).join('&');
    const url = `${ARCHIVE_API}?q=${encodeURIComponent(query)}&${fieldParams}&sort[]=${sortBy}+${sortOrder}&rows=${rowsPerPage}&page=${page}&output=json`;

    // Archive.org intermittently returns 502s. Its error pages carry no CORS header, so a
    // browser reports them as "Failed to fetch". Retry those; don't retry a bad request.
    let response;
    for (let attempt = 1; ; attempt++) {
      let failure;
      try {
        response = await fetch(url);
        if (response.ok) break;
        failure = new Error(`Archive.org API error: ${response.status}`);
        if (response.status < 500) throw failure;
      } catch (err) {
        if (err === failure) throw err;
        failure = failure || err;
      }
      if (attempt === 3) throw failure;
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
    }

    const data = await response.json();

    // Archive.org reports query errors in the body with HTTP 200
    if (data.error) {
      throw new Error(`Archive.org API error: ${data.error}`);
    }

    if (!data.response || !data.response.docs) {
      return { movies: [], total: 0 };
    }

    const movies = data.response.docs
      .filter(movie => !isBlockedContent(movie)) // Filter out inappropriate content
      .map(movie => this.normalizeMovie(movie));

    // Filter by runtime if specified
    const filteredMovies = minRuntime > 0
      ? movies.filter(m => m.runtimeMinutes >= minRuntime)
      : movies;

    return {
      movies: filteredMovies,
      total: data.response.numFound || 0,
      unfilteredCount: movies.length
    };
  }

  // Fetch server pages until `count` movies pass `filter`, so client-side
  // filtering never produces empty or near-empty pages.
  // Returns nextPage = null once Archive.org has no more results.
  async fetchFiltered(options = {}) {
    const {
      count = 24,
      startPage = 1,
      maxPages = 5, // cap requests per batch; sparse collections just need more "load more" clicks
      rowsPerPage = 50,
      filter = () => true,
      seenTitles = new Set(), // films already shown; pass the same Set back in to dedupe across batches
      ...fetchOptions
    } = options;

    const movies = [];
    let nextPage = startPage;
    let total = 0;

    while (movies.length < count && nextPage !== null && nextPage < startPage + maxPages) {
      const page = nextPage;
      const result = await this.fetchMovies({ ...fetchOptions, page, rowsPerPage });
      total = result.total;

      for (const movie of result.movies) {
        // The same film is uploaded many times. Same title counts as a duplicate
        // unless both copies state a year and the years differ (The Bat 1926 vs 1959).
        const key = this.dedupeKey(movie.title);
        // A year in the title is the film's. A metadata year equal to the upload year is
        // usually the uploader's default, not the film's, so it can't tell two films apart.
        const uploadYear = Number(String(movie.publicDate || '').slice(0, 4));
        const year = String(movie.title).match(FILM_YEAR)?.[0] ??
          (movie.year !== uploadYear ? movie.year : null);
        const duplicate = year
          ? seenTitles.has(`${key}|${year}`) || seenTitles.has(`${key}|?`)
          : seenTitles.has(key);
        if (duplicate || !filter(movie)) continue;
        seenTitles.add(key);
        seenTitles.add(`${key}|${year ?? '?'}`);
        movies.push(movie);
      }

      nextPage = page * rowsPerPage >= total ? null : page + 1;
    }

    // Popularity order ranks subject-only matches above the film itself, so list title matches first
    const words = this.searchWords(fetchOptions.searchQuery);
    if (words && (fetchOptions.sortBy ?? 'downloads') === 'downloads') {
      const inTitle = (m) => words.every(w => String(m.title).toLowerCase().includes(w));
      movies.sort((a, b) => inTitle(b) - inTitle(a));
    }

    return { movies, total, nextPage };
  }

  // Get detailed metadata for a single item
  async getMetadata(identifier) {
    const response = await fetch(`${ARCHIVE_METADATA_API}/${identifier}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`);
    }

    return response.json();
  }

  // Fetch and normalize one item's metadata for direct, hash-based links.
  async getMovieByIdentifier(identifier) {
    const data = await this.getMetadata(identifier);
    if (!data?.metadata || !data.metadata.identifier) {
      throw new Error(`Archive.org item not found: ${identifier}`);
    }

    const movie = this.normalizeMovie(data.metadata);
    if (isBlockedContent(movie)) {
      throw new Error(`Archive.org item is blocked: ${identifier}`);
    }

    return movie;
  }

  // Format runtime for display
  formatRuntime(minutes) {
    if (!minutes || minutes <= 0) return 'Unknown';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  }
}

export const archiveService = new ArchiveService();
export default archiveService;
