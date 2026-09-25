import { matchRanges, suggestTags } from './suggest.js';
import { isTakenDown, isForbidden, isForbiddenSearch } from './policy.js';
// Archive.org API Service

const ARCHIVE_API = 'https://archive.org/advancedsearch.php';
const ARCHIVE_METADATA_API = 'https://archive.org/metadata';
const RESPONSE_TTL_MS = 5 * 60 * 1000;
const MAX_RESPONSES = 100;

const BLOCKED_TITLE_PATTERNS = [/\bthe child\b/i];
// Identifier separators and year suffixes delimit tokens, but longer words do not.
const BLOCKED_IDENTIFIER_PATTERNS = [/(^|[^a-z])thechild([^a-z]|$)/i];

// Video categories/collections available on Archive.org
// Collection IDs are case-sensitive and must match exactly
// `films: true` marks collections of narrative films; genre pills browse across all of them.
// `features: true` marks collections of feature-length films, which default to a 40+ minute
// filter. Everything else is mostly shorts or has no runtime recorded, so it defaults to any length.
export const VIDEO_CATEGORIES = [
  { id: 'feature_films', films: true, features: true, name: 'Feature Films', description: 'Classic feature-length movies' },
  { id: 'moviesandfilms', films: true, features: true, name: 'Movies & Films', description: 'Full-length films from the Archive' },
  // Genre-named collections are not offered in the dropdown: genre lives in the pills only
  // (asGenre). wholly: every film in the collection belongs to that genre, tagged or not.
  { id: 'Film_Noir', films: true, features: true, name: 'Film Noir', description: 'Dark crime dramas and thrillers', asGenre: 'Film Noir', wholly: true },
  { id: 'SciFi_Horror', films: true, features: true, name: 'Sci-Fi & Horror', description: 'Science fiction and horror films', asGenre: 'Horror' },
  { id: 'silent_films', films: true, name: 'Silent Films', description: 'Silent era classics' },
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
// "All Films" in the collection dropdown: every film collection at once. It is the default, so
// the genre pills have thousands of films to narrow, and the dropdown never has to lie.
export const ALL_FILMS = 'all';
// Archive.org's Moving Image Archive, the parent of every video collection: all of its video
// (17 million uploads), without the TV news clips. Mostly not films, so it starts at feature length.
export const EVERYTHING = 'movies';

// A collection's name for the dropdown: ours, everything, or the identifier of one we don't list
export function collectionName(id) {
  if (id === EVERYTHING) return 'All of Archive.org';
  return VIDEO_CATEGORIES.find(c => c.id === id)?.name || id;
}

// What the collection dropdown offers
export const BROWSABLE_COLLECTIONS = VIDEO_CATEGORIES.filter(c => !c.asGenre);

// Where a collection id leads: itself, or for a collection that is wholly one genre (an old link,
// a pasted Archive.org link to Film_Noir) All Films with that genre's pill selected. A mixed one
// (SciFi_Horror is science fiction and horror) opens as itself: the pill would lose half of it.
export function collectionChoice(id) {
  const category = VIDEO_CATEGORIES.find(c => c.id === id);
  const genre = category?.wholly && category.asGenre;
  return genre ? { collection: ALL_FILMS, genre } : { collection: id, genre: null };
}

export function defaultMinRuntime(collectionId) {
  return collectionId === ALL_FILMS || collectionId === EVERYTHING || VIDEO_CATEGORIES.find(c => c.id === collectionId)?.features ? 40 : 0;
}

// Predicate for the Full Movies / Shorts toggle. Many Archive.org items have no runtime
// recorded, which is not evidence of a short, so only a known runtime can exclude a film.
// A trailer rarely has a runtime either, so among films of unknown length the title decides:
// "Psycho trailer" is one, "Wheels On Meals (1984) with Trailers" is a film with extras.
const TRAILER = /\b(trailers?|teasers?|tv spots?)\b/i;
// Uploads tagged as trailers, left out at the source outside Shorts. About a third of a genre and
// decade search; of 6,000 so tagged, none was a feature-length film in the index (2026-09-23).
const NOT_TRAILERS = ' AND NOT subject:(trailer* OR teaser*)'; // short: the longest query we build is 2,183 characters encoded, and Archive.org truncates past about 2,200
// Archive.org's own query syntax typed into the search box (subject:horror AND year:[1980 TO 1989]):
// a known field name straight before a colon and a value, so "2001: A Space Odyssey" stays a title
const FIELDS = 'mediatype|subject|year|date|title|creator|collection|identifier|description|language|publicdate|addeddate|downloads|format|licenseurl|avg_rating|num_reviews|runtime|publisher|contributor|coverage|source';
const QUERY_SYNTAX = new RegExp(`(^|[\\s(])(${FIELDS}):[^\\s]`, 'i');
// Only when its brackets and quotes close within it: the query runs wrapped in brackets with our
// filters after it, so it must stay inside them. Backslashes and /regex/ are not taken (they hide
// brackets from this count), nor ? and ~ (one-letter wildcards and fuzzy terms, which the word
// check in policy.js cannot read). Anything else is searched as plain words.
function balanced(text) {
  if (/[\\/?~]/.test(text)) return false;
  let groups = 0, ranges = 0, quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (ch === '(') groups++;
    else if (ch === ')' && --groups < 0) return false;
    else if (ch === '[' || ch === '{') ranges++;
    else if ((ch === ']' || ch === '}') && --ranges < 0) return false;
  }
  return !quoted && groups === 0 && ranges === 0;
}
const RAW_MAX = 300;
export const isArchiveQuery = text => QUERY_SYNTAX.test(String(text || '')) && balanced(String(text || '').slice(0, RAW_MAX));
const MIN_MB_PER_MINUTE = 2.5;
const FILM_WITH_TRAILERS = /(\b(with|and|plus)|[&+])\s+(\w+\s+)?trailers?\b/i;

export function runtimeFilter({ shorts = false, minRuntime = 0 } = {}) {
  return (movie) => {
    if (movie.runtimeMinutes === 0) {
      if (shorts) return true;
      // Trailers are often titled like the film itself ("Do the Right Thing", 52 MB). Even a
      // low-bitrate transfer needs about 2.5 MB a minute, and real features run 400 MB and up.
      if (movie.sizeMB && movie.sizeMB < minRuntime * MIN_MB_PER_MINUTE) return false;
      const title = String(movie.title || '');
      return !TRAILER.test(title) || FILM_WITH_TRAILERS.test(title);
    }
    return shorts ? movie.runtimeMinutes <= 30 : movie.runtimeMinutes >= minRuntime;
  };
}

// Decades offered as a filter
export const DECADES = [1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

// Uploaders often leave "date" at the upload date, or the year before it (Drunken Master, 1978,
// was dated 2026), so such a date says nothing about the film. Nothing was uploaded to
// Archive.org before 2000, which makes every earlier date trustworthy. Lucene cannot compare two
// fields, hence one clause per year; this short form is about as long as Archive.org accepts.
// Kept short (about 40 characters a year): Archive.org silently truncates long queries, and a
// truncated guard let 2026-dated uploads sort to the top of "newest".
function uploadDates(from, to) {
  const clauses = [];
  for (let year = Math.max(from, 2000); year <= Math.min(to, new Date().getFullYear()); year++) {
    clauses.push(`(year:${year} AND publicdate:[${year} TO ${year + 1}])`);
  }
  return clauses.length ? ` AND NOT (${clauses.join(' OR ')})` : '';
}

// Sub-collections inside the film collections that are not films: the trailer bin (60,246 of
// the 110,772 items), stock footage, home movies, digitisation deposits with numbered reels.
// Left out of every browse and search; Shorts keeps the trailer bin, since that is where
// trailers belong.
export const NOT_FILMS = ['movie_trailers_unsorted', 'iicadom', 'home_movies', '35mmstockfootage', 'stock_footage', 'prelinger_mashups', 'laserdiscs'];

// Content filter - block inappropriate content
function isBlockedContent(movie) {
  if (!movie) return true;

  // Handle title being string or array
  const title = Array.isArray(movie.title) ? movie.title[0] : movie.title;
  return isTakenDown(movie.identifier) || BLOCKED_TITLE_PATTERNS.some(pattern => pattern.test(String(title || ''))) ||
    BLOCKED_IDENTIFIER_PATTERNS.some(pattern => pattern.test(String(movie.identifier || ''))) ||
    // What never appears here (src/services/policy.js): a raw result has `subject`, a normalised film `tags`
    isForbidden({ title, description: movie.description, subject: movie.subject, tags: movie.tags });
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
export const UPLOAD_NOISE = /\b(\d{3,4}p|4k|\d+fps|\d+kb|full hd|hd|uhd|blu ?ray|bdrip|brrip|dvdrip|dvd|mpeg\d?|mp4|avi|mkv|full movie|widescreen|colou?rized|restored|remastered|video quality|quality|upgrade|uncut)\b/g;
export const FILM_YEAR = /\b(18|19|20)\d{2}\b/g;

const HIGH_QUALITY = /\b(4k|2160p|1080p|full hd|uhd|blu[- ]?ray|restored|remastered)\b/gi;
const LOW_QUALITY = /\b(\d+kb|ipod|vhs|low quality)\b/gi;

function qualityScore(movie) {
  const title = String(movie.title || '');
  return (title.match(HIGH_QUALITY)?.length || 0) - (title.match(LOW_QUALITY)?.length || 0);
}

// What Archive.org's visitors say about two copies of one film: a copy several reviewers panned
// (usually the picture or the sound) loses, then one with at least twice the favourites wins.
// Takes { favorites, panned }; above 0 when a is the one people chose, 0 when they say nothing.
export const panned = ({ reviews, rating }) => reviews >= 3 && rating > 0 && rating <= 2;
export function byAudience(a, b) {
  if (a.panned !== b.panned) return a.panned ? -1 : 1;
  const [fa, fb] = [a.favorites || 0, b.favorites || 0];
  return Math.max(fa, fb) >= 10 && (fa >= 2 * fb || fb >= 2 * fa) ? Math.sign(fa - fb) : 0;
}

// Identifiers split into searches Archive.org will take: identifier:("a" OR "b" ...), each
// under the ~2,200 characters a query can run to before Archive.org refuses it
export function identifierQueries(ids, max = 2000) {
  const queries = [];
  let batch = [];
  const query = list => `identifier:(${list.map(id => `"${id}"`).join(' OR ')})`;
  for (const id of ids) {
    if (batch.length && query([...batch, id]).length > max) { queries.push({ ids: batch, q: query(batch) }); batch = []; }
    batch.push(id);
  }
  if (batch.length) queries.push({ ids: batch, q: query(batch) });
  return queries;
}

export function betterCopy(a, b) {
  const audience = byAudience({ favorites: a.favorites, panned: panned(a) }, { favorites: b.favorites, panned: panned(b) });
  if (audience !== 0) return audience > 0 ? a : b;
  const quality = qualityScore(a) - qualityScore(b);
  if (quality !== 0) return quality > 0 ? a : b;
  const size = (a.sizeMB || 0) - (b.sizeMB || 0);
  if (size !== 0) return size > 0 ? a : b;
  return a;
}

class ArchiveService {
  movieResponses = new Map();

  // The film's year: one written in the title wins ("House on Haunted Hill (1999)"), and a
  // metadata year equal to the upload year is the uploader's default, so it counts as unknown.
  filmYear(title, metadataYear, publicDate) {
    const text = String(title || '');
    const inTitle = text.replace(FILM_YEAR, '').replace(/[^\p{L}\p{N}]/gu, '') ? text.match(FILM_YEAR)?.[0] : null;
    if (inTitle) return Number(inTitle);
    const year = metadataYear ? parseInt(metadataYear, 10) : null;
    return year && year === Number(String(publicDate || '').slice(0, 4)) ? null : year;
  }

  normalizeMovie(movie) {
    const runtimeMinutes = this.parseRuntime(movie.runtime);
    const genres = this.extractGenres(movie.subject);
    const title = Array.isArray(movie.title) ? movie.title[0] : movie.title;

    return {
      id: movie.identifier,
      identifier: movie.identifier,
      title: title || movie.identifier,
      year: this.filmYear(title, movie.year, movie.publicdate),
      runtimeMinutes,
      runtime: movie.runtime,
      genres: genres.length > 0 ? genres : ['Uncategorized'],
      // The uploader's own words, as written: one field, a list, or "a; b, c" in a string
      tags: [].concat(movie.subject || []).flatMap(subject => String(subject).split(/[;,]/)).map(tag => tag.trim()).filter(Boolean),
      downloads: movie.downloads || 0,
      sizeMB: movie.item_size ? Math.round(movie.item_size / 1e6) : null,
      rating: movie.avg_rating || null,
      reviews: movie.num_reviews || 0,
      favorites: movie.num_favorites || 0,
      description: movie.description,
      creator: Array.isArray(movie.creator) ? movie.creator[0] : movie.creator,
      archiveUrl: `https://archive.org/details/${movie.identifier}`,
      thumbnailUrl: `https://archive.org/services/img/${movie.identifier}`,
      embedUrl: `https://archive.org/embed/${movie.identifier}`,
      date: movie.date || movie.publicdate,
      publicDate: movie.publicdate
    };
  }

  betterCopy(a, b) {
    return betterCopy(a, b);
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

    // Check aliases first (the table's own names only, whatever an uploader tags)
    if (Object.hasOwn(GENRE_ALIASES, lowerGenre)) {
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
      String(s).split(/[;,/]/).forEach(part => {
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
    // Keep apostrophes inside a word (bernie's, wasn't) so we can search both spellings.
    // Quotes and backslashes are still dropped: they are not letters, digits, or apostrophes.
    // A phone types the curly ’ (and some keyboards ʼ, ´, ` or ′): the same mark. Combining
    // marks belong to their word: Hindi vowel signs ("शोले"), accents typed as two characters.
    return String(searchQuery || '').toLowerCase().replace(/[\u2018\u2019\u02bc\u00b4\u0060\u2032]/g, "'").match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:'[\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu)?.slice(0, 12);
  }

  // A word with an apostrophe must match both spellings: Archive titles often omit it.
  // fuzzy: allow a letter or two off in a longer word ("nosferato" finds Nosferatu)
  searchTerm(word, fuzzy = false) {
    if (!word.includes("'")) return fuzzy && word.length >= 5 ? `${word}~${word.length >= 10 ? 2 : 1}` : word;
    const plain = word.replace(/'/g, '');
    return plain ? `("${word}" OR ${plain})` : word;
  }

  // Every word must match, and each pair of neighbours may also be one word: "sleep away camp"
  // finds Sleepaway Camp and "night mare" finds Nightmare. Up to six words (the query has a length
  // limit, and longer searches are rarely split by mistake).
  // With fuzzy, the last word may also be unfinished ("the missing piec" is The Missing Piece).
  wordsQuery(words, fuzzy = false) {
    const terms = words.map(word => this.searchTerm(word, fuzzy));
    const last = words.at(-1);
    if (fuzzy && last.length >= 3 && !last.includes("'")) terms[terms.length - 1] = `(${terms.at(-1)} OR ${last}*)`;
    const variants = [terms];
    if (words.length <= 6) {
      for (let i = 0; i < words.length - 1; i++) {
        if (words[i].includes("'") || words[i + 1].includes("'")) continue;
        variants.push([...terms.slice(0, i), this.searchTerm(words[i] + words[i + 1], fuzzy), ...terms.slice(i + 2)]);
      }
    }
    return variants.length === 1 ? `(${terms.join(' AND ')})` : `(${variants.map(v => `(${v.join(' AND ')})`).join(' OR ')})`;
  }

  // Build search query
  buildQuery(options = {}) {
    const {
      searchQuery = '',
      collection = 'moviesandfilms',
      minRuntime: _minRuntime = null, // applied by the caller's filter, not here
      year = null,
      genre = null,
      decade = null, // one of DECADES
      dated = false, // only films whose release date can be trusted (for sorting by it)
      shorts = false,
      fuzzy = false, // close spellings too (fetchFiltered's second try when nothing matched)
    } = options;

    // Just filter by collection - the collection itself defines content type
    // Adding mediatype filter is too restrictive for many collections
    const filmCollections = `collection:(${VIDEO_CATEGORIES.filter(c => c.films).map(c => c.id).join(' OR ')})`;
    let query = collection === ALL_FILMS ? filmCollections
      : collection === EVERYTHING ? 'mediatype:movies AND NOT collection:(tvnews OR tvarchive)'
      : `collection:"${collection}"`;

    // Match every search word (a phrase match finds nothing for "night living").
    // Only letters and digits survive - Archive.org's backend errors on escaped quotes.
    const words = isArchiveQuery(searchQuery) ? null : this.searchWords(searchQuery);
    if (isArchiveQuery(searchQuery)) query = `(${searchQuery.slice(0, RAW_MAX)})`; // their query, as written
    if (words) {
      // A search looks in every collection the app offers, not just the selected one
      query = `collection:(${VIDEO_CATEGORIES.map(c => c.id).join(' OR ')})`;
      // Search in title, subject, and creator
      const all = this.wordsQuery(words, fuzzy);
      // Close spellings are matched against titles only: across tags and uploader names they
      // find whatever happens to be one letter away
      query += fuzzy ? ` AND title:${all}` : ` AND (title:${all} OR subject:${all} OR creator:${all})`;
    }

    // Add genre filter to query for better results
    if (genre && genre !== 'all') {
      // The genre narrows whatever the collection dropdown says (All Films by default). It used
      // to switch to every film collection on its own, leaving the dropdown showing the wrong thing.
      // Include aliases so the server matches what normalizeGenre() maps to this genre
      const names = [genre, ...Object.keys(GENRE_ALIASES).filter(alias => GENRE_ALIASES[alias] === genre)];
      const subjects = `subject:(${names.map(n => `"${n}"`).join(' OR ')})`;
      const curated = VIDEO_CATEGORIES.filter(c => c.wholly && c.asGenre === genre).map(c => c.id);
      query += curated.length ? ` AND (${subjects} OR collection:(${curated.join(' OR ')}))` : ` AND ${subjects}`;
    }

    if (year) {
      query += ` AND year:${year}`;
    }

    if (DECADES.includes(Number(decade))) {
      const from = Number(decade);
      const range = `date:[${from}-01-01 TO ${from + 9}-12-31]${uploadDates(from, from + 9)}`;
      // A year in the title ("Hellhole (1985)") counts too, except when sorting by date:
      // those uploads carry an upload date and would sort ahead of everything
      const years = Array.from({ length: 10 }, (_, i) => from + i).join(' OR ');
      query += dated ? ` AND ${range}` : ` AND ((${range}) OR title:(${years}))`;
    } else if (dated) {
      query += ` AND date:[1880-01-01 TO ${new Date().getFullYear()}-12-31]${uploadDates(2000, 9999)}`;
    }

    // Collections contain sub-collections ("Silent Films", "Vintage Cartoons"), which are
    // folders, not videos. A mediatype:movies filter would be too strict for some collections.
    query += ' AND NOT mediatype:collection';
    // Never exclude the collection itself when someone opened it (home_movies, from a link)
    const notFilms = (shorts ? NOT_FILMS.filter(c => c !== 'movie_trailers_unsorted') : NOT_FILMS).filter(c => c !== collection);
    query += ` AND NOT collection:(${notFilms.join(' OR ')})`;
    if (!shorts) query += NOT_TRAILERS;

    return query;
  }

  // Query for search suggestions: every typed word is a prefix of some title word, in any
  // order, within the film collections. Null when there is too little to go on.
  buildSuggestQuery(text) {
    const words = (this.searchWords(text) || []).filter(word => word.length >= 2);
    if (!words.length || words.join('').length < 3) return null;
    const films = VIDEO_CATEGORIES.filter(c => c.films).map(c => c.id).join(' OR ');
    const prefixes = `(${words.map(w => {
      if (!w.includes("'")) return `${w}*`;
      const plain = w.replace(/'/g, '');
      return plain ? `(${w}* OR ${plain}*)` : `${w}*`;
    }).join(' AND ')})`;
    // Subjects ride along in the same request, so tag suggestions cost Archive.org nothing extra
    return `collection:(${films}) AND (title:${prefixes} OR subject:${prefixes}) AND NOT mediatype:collection`;
  }

  // What to offer while someone types: a few distinct, most-downloaded films whose titles match,
  // and the tags uploaders use that match. Archive.org takes 1.5-4 s, so callers debounce, pass
  // an AbortSignal, and show local matches first.
  async suggest(text, { signal, limit = 6 } = {}) {
    if (isForbiddenSearch(text)) return { films: [], tags: [] };
    const query = this.buildSuggestQuery(text);
    if (!query) return { films: [], tags: [] };
    const { movies } = await this.fetchMovies({ query, rowsPerPage: 60, signal });
    const seen = new Set();
    const films = movies.filter(movie => {
      if (!matchRanges(movie.title, text)) return false; // matched by a tag only
      const key = this.dedupeKey(movie.title);
      return seen.has(key) ? false : seen.add(key);
    }).slice(0, limit);
    // A film's own title used as a tag ("white zombie", on its re-uploads) is already offered as
    // a film. A theme that happens to be someone's title ("kung fu") is used far more widely.
    const titled = new Map();
    for (const movie of movies) titled.set(this.dedupeKey(movie.title), (titled.get(this.dedupeKey(movie.title)) || 0) + 1);
    const tags = suggestTags(movies, text, { exclude: STANDARD_GENRES, limit: 8 })
      .filter(tag => tag.count > 2 * (titled.get(this.dedupeKey(tag.label)) || 0))
      .slice(0, 4);
    return { films, tags };
  }

  // Store raw responses so each caller gets freshly normalized movies and its own runtime filter.
  async fetchMovieResponse(url, { signal, timeoutMs, retryDelayMs }) {
    signal?.throwIfAborted();
    const cached = this.movieResponses.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    this.movieResponses.delete(url);

    // Archive.org intermittently returns 502s. Its error pages carry no CORS header, so a
    // browser reports them as "Failed to fetch". Retry those; don't retry a bad request.
    let response;
    for (let attempt = 1; ; attempt++) {
      let failure;
      const timer = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; timer.abort(); }, timeoutMs);
      signal?.addEventListener('abort', () => timer.abort(), { once: true });
      try {
        response = await fetch(url, { signal: timer.signal });
        if (response.ok) break;
        failure = new Error(`Archive.org API error: ${response.status}`);
        if (response.status < 500) throw failure;
      } catch (err) {
        if (err === failure) throw err;
        if (err.name === 'AbortError') {
          if (!timedOut) throw err; // cancelled by the caller: not a failure, not retried
          failure = new Error('Archive.org took too long to answer'); // a hung request is
        } else {
          failure = failure || err;
        }
      } finally {
        clearTimeout(timeout);
      }
      if (attempt === 3) throw failure;
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
    }

    const data = await response.json();

    // Archive.org reports query errors in the body with HTTP 200
    if (data.error) {
      throw new Error(`Archive.org API error: ${data.error}`);
    }

    if (!Array.isArray(data.response?.docs)) {
      return data;
    }

    const now = Date.now();
    for (const [key, entry] of this.movieResponses) {
      if (entry.expiresAt <= now) this.movieResponses.delete(key);
    }
    this.movieResponses.set(url, { data, expiresAt: now + RESPONSE_TTL_MS });
    while (this.movieResponses.size > MAX_RESPONSES) {
      this.movieResponses.delete(this.movieResponses.keys().next().value);
    }
    return data;
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
      decade = null,
      retryDelayMs = 600,
      timeoutMs = 20000, // Archive.org usually answers in 1.5-4 s; a request that never answers must not spin forever
      signal,
      query: queryOverride = null,
      fuzzy = false,
    } = options;

    const query = queryOverride || this.buildQuery({ searchQuery, genre, collection, decade, dated: sortBy === 'date', fuzzy });

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
      'num_reviews',
      'num_favorites',
      'date',
      'publicdate',
      'item_size'
    ];

    const fieldParams = fields.map(f => `fl[]=${f}`).join('&');
    const url = `${ARCHIVE_API}?q=${encodeURIComponent(query)}&${fieldParams}&sort[]=${sortBy}+${sortOrder}&rows=${rowsPerPage}&page=${page}&output=json`;

    const data = await this.fetchMovieResponse(url, { signal, timeoutMs, retryDelayMs });
    if (!data.response || !data.response.docs) return { movies: [], total: 0 };

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

    // A search for what never appears here gets nothing, and Archive.org is never asked
    if (isForbiddenSearch(fetchOptions.searchQuery)) return { movies: [], total: 0, nextPage: null };
    const movies = [];
    let nextPage = startPage;
    let total = 0;

    while (movies.length < count && nextPage !== null && nextPage < startPage + maxPages) {
      const page = nextPage;
      const result = await this.fetchMovies({ ...fetchOptions, page, rowsPerPage });
      total = result.total;

      const selected = [];
      for (const movie of result.movies) {
        if (!filter(movie)) continue;
        // The same film is uploaded many times. Same title counts as a duplicate
        // unless both copies state a year and the years differ (The Bat 1926 vs 1959).
        const key = this.dedupeKey(movie.title);
        // A year in the title is the film's. A metadata year equal to the upload year is
        // usually the uploader's default, not the film's, so it can't tell two films apart.
        const uploadYear = Number(String(movie.publicDate || '').slice(0, 4));
        const rawYear = String(movie.title).match(FILM_YEAR)?.[0] ??
          (movie.year !== uploadYear ? movie.year : null);
        const year = rawYear == null || rawYear === '' ? null : Number(rawYear);
        const sameBatch = selected.find(entry =>
          entry.key === key && (!entry.year || !year || entry.year === year));
        if (sameBatch) {
          movies[sameBatch.index] = this.betterCopy(movies[sameBatch.index], movie);
          continue;
        }
        const duplicate = year
          ? seenTitles.has(`${key}|${year}`) || seenTitles.has(`${key}|?`)
          : seenTitles.has(key);
        if (duplicate) continue;
        seenTitles.add(key);
        seenTitles.add(`${key}|${year ?? '?'}`);
        selected.push({ key, year, index: movies.length });
        movies.push(movie);
      }

      nextPage = page * rowsPerPage >= total ? null : page + 1;
    }

    // Popularity order ranks subject-only matches above the film itself, so list title matches first
    const words = this.searchWords(fetchOptions.searchQuery);
    if (words && (fetchOptions.sortBy ?? 'downloads') === 'downloads') {
      const inTitle = (m) => {
        const title = String(m.title).toLowerCase();
        return words.every(w => title.includes(w) || title.includes(w.replace(/'/g, '')));
      };
      movies.sort((a, b) => inTitle(b) - inTitle(a));
    }

    // Nothing at all for a typed search: once more with close spellings, and say so
    if (!movies.length && startPage === 1 && !fetchOptions.fuzzy && words && !isArchiveQuery(fetchOptions.searchQuery)) {
      const closer = await this.fetchFiltered({ ...options, fuzzy: true });
      return { ...closer, closeSpellings: closer.movies.length > 0 };
    }

    return { movies, total, nextPage };
  }

  // Get detailed metadata for a single item
  // One request per item per visit: the film page, its player and its list of films all ask
  getMetadata(identifier) {
    this.metadata ||= new Map();
    if (!this.metadata.has(identifier)) {
      this.metadata.set(identifier, fetch(`${ARCHIVE_METADATA_API}/${identifier}`).then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch metadata: ${response.status}`);
        return response.json();
      }).catch((error) => { this.metadata.delete(identifier); throw error; })); // a failure is asked again
    }
    return this.metadata.get(identifier);
  }

  // Fetch and normalize one item's metadata for direct, hash-based links.
  async getMovieByIdentifier(identifier) {
    const data = await this.getMetadata(identifier);
    if (!data?.metadata || !data.metadata.identifier) {
      throw new Error(`Archive.org item not found: ${identifier}`);
    }

    // A collection is not a film: say so, and the page browses it instead
    if (data.metadata.mediatype === 'collection') {
      throw Object.assign(new Error(`${identifier} is a collection of films, not a film`), { collection: identifier });
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
