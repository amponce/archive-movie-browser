// Archive.org API Service

const ARCHIVE_API = 'https://archive.org/advancedsearch.php';
const ARCHIVE_METADATA_API = 'https://archive.org/metadata';

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

class ArchiveService {
  // Parse runtime from various formats
  parseRuntime(runtime) {
    if (!runtime) return 0;
    const runtimeStr = String(runtime);

    // Handle HH:MM:SS or MM:SS format
    if (runtimeStr.includes(':')) {
      const parts = runtimeStr.split(':').map(Number);
      if (parts.length === 3) {
        return parts[0] * 60 + parts[1] + parts[2] / 60;
      } else if (parts.length === 2) {
        // Could be HH:MM or MM:SS - assume MM:SS if first part < 10
        if (parts[0] < 10) {
          return parts[0] + parts[1] / 60;
        }
        return parts[0] * 60 + parts[1];
      }
    }

    // Handle "90 min", "90 minutes", etc.
    const numMatch = runtimeStr.match(/(\d+)/);
    return numMatch ? parseInt(numMatch[1], 10) : 0;
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

  // Build search query
  buildQuery(options = {}) {
    const {
      searchQuery = '',
      collection = 'moviesandfilms',
      mediaType = 'movies',
      minRuntime = null,
      year = null,
      genre = null
    } = options;

    let query = `collection:"${collection}" AND mediatype:${mediaType}`;

    if (searchQuery) {
      // Search in title, subject, and creator
      query += ` AND (title:"${searchQuery}" OR subject:"${searchQuery}" OR creator:"${searchQuery}")`;
    }

    // Add genre filter to query for better results
    if (genre && genre !== 'all') {
      query += ` AND subject:"${genre}"`;
    }

    if (year) {
      query += ` AND year:${year}`;
    }

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
      genre = null
    } = options;

    const query = this.buildQuery({ searchQuery, genre });

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

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Archive.org API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.response || !data.response.docs) {
      return { movies: [], total: 0 };
    }

    const movies = data.response.docs
      .filter(movie => !isBlockedContent(movie)) // Filter out inappropriate content
      .map(movie => {
        const runtimeMinutes = this.parseRuntime(movie.runtime);
        const genres = this.extractGenres(movie.subject);
        // Handle title being string or array
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
          date: movie.date || movie.publicdate
        };
      });

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

  // Get detailed metadata for a single item
  async getMetadata(identifier) {
    const response = await fetch(`${ARCHIVE_METADATA_API}/${identifier}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status}`);
    }

    return response.json();
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
