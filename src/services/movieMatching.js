import { UPLOAD_NOISE, FILM_YEAR } from './archive.js';

const NOISE = new RegExp(UPLOAD_NOISE.source, 'gi');
const SUBTITLE_NOISE = /\b(eng(lish)?\s+(hard\s*)?sub(s|titles?)?|hard\s*subs?|legendado|dublado|dubbed|doblada( al espa[nñ]ol)?)\b/gi;
const SEPARATOR = /\s+-\s+|:\s+|\s+\|\s+|\s+aka\s+/i;
// One-word notes that are also film titles on TMDB ("Unrated", "Trailer")
const GENERIC = /^(unrated|trailer|version|episode|complete|original|classic|movie|film|part|silent)$/i;

const releaseYear = movie => Number(movie.release_date?.slice(0, 4)) || null;

// The year written in a title is the film's; Archive.org's year field is often the upload year.
export function filmYearFromTitle(title) {
  const text = String(title);
  if (!text.replace(FILM_YEAR, '').replace(/[^\p{L}\p{N}]/gu, '')) return null; // "1984" is a title
  const year = text.match(FILM_YEAR)?.[0];
  return year ? Number(year) : null;
}

// Archive.org titles bury the film's name in upload notes: "Nosferatu_DVD_quality",
// "Nekromantik(1987) ENGLISH HARD SUB", "Das Kabinett ... ( The Cabinet of Dr. Caligari )",
// "Fright Night: House on Haunted Hill". Returns up to four TMDB queries: the tidied title,
// then `strict` guesses at the real title, which only count on an exact or close match.
export function titleCandidates(title) {
  const tidy = text => text
    .replace(SUBTITLE_NOISE, ' ')
    .replace(NOISE, ' ')
    .replace(FILM_YEAR, ' ')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const raw = String(title).replace(/_/g, ' ');
  const alternates = [...raw.matchAll(/[([]([^)\]]*)[)\]]/g)].map(match => match[1]);
  let base = raw.replace(/[([][^)\]]*[)\]]/g, ' ');
  base = base.replace(/^(.*?)\s*,\s*(the|an|a)\s*$/i, '$2 $1'); // "Phantom Ship , The"

  const main = tidy(base) || raw.trim(); // a title that is nothing but a year, e.g. "1984"
  const candidates = [{ query: main, strict: false }];
  const guess = text => {
    const query = tidy(text);
    const worthTrying = query.includes(' ') || (query.length >= 6 && !GENERIC.test(query));
    if (worthTrying && candidates.length < 4 && !candidates.some(c => c.query.toLowerCase() === query.toLowerCase())) {
      candidates.push({ query, strict: true });
    }
  };
  alternates.forEach(guess);
  const parts = base.split(SEPARATOR);
  if (parts.length > 1) parts.forEach(guess);
  return candidates;
}

// Among films that all matched, the one closest to the known year; the oldest when it is unknown,
// because this archive is mostly classics and TMDB lists remakes first. Archive.org years run
// late (re-release, VHS date) but a film cannot be newer than its upload claims, so later
// releases are rejected rather than shown as a wrong poster.
function closest(movies, year) {
  const eligible = year ? movies.filter(movie => (releaseYear(movie) ?? 0) <= year + 1) : movies;
  if (!eligible.length) return null;
  const distance = movie => (year ? Math.abs((releaseYear(movie) ?? 9999) - year) : releaseYear(movie) ?? 9999);
  return eligible.reduce((best, movie) => (distance(movie) < distance(best) ? movie : best));
}

// Pick between the matches of several strict guesses ("Fright Night" vs "House on Haunted Hill")
export function bestStrictMatch(matches, year = null) {
  return closest(matches.filter(Boolean), year ? Number(year) : null);
}

export function cleanMovieTitle(title) {
  return title
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/\s*\[\d{4}\]\s*$/, '')
    .replace(/\s*-\s*\d{4}\s*$/, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function selectMovieMatch(results, title, year = null, { strict = false } = {}) {
  if (!results?.length) return null;
  const known = year ? Number(year) : null;
  const searchTitle = cleanMovieTitle(title).toLowerCase();
  if (!searchTitle) return null;
  const titled = results.map(movie => ({ movie, title: cleanMovieTitle(movie.title || '').toLowerCase() }));
  const wholeWords = (shorter, longer) => ` ${longer} `.includes(` ${shorter} `);

  const exact = titled.filter(candidate => candidate.title === searchTitle).map(c => c.movie);
  if (exact.length) return closest(exact, known);

  // A short word inside an unrelated title is not a useful match. Require
  // whole words and at least three quarters of the longer title.
  const close = titled.filter(candidate => {
    const [shorter, longer] = [searchTitle, candidate.title].sort((a, b) => a.length - b.length);
    return shorter.length >= 4 && shorter.length / longer.length >= 0.75 && wholeWords(shorter, longer);
  }).map(c => c.movie);
  if (close.length) return closest(close, known);

  // TMDB's top result still counts when one title contains the other as whole words
  // ("The Pawnshop" for "Charlie Chaplin's The Pawnshop"); an unrelated first result does not.
  // A strict query is already a guess at the real title, so it gets no fallback at all.
  if (strict || !results[0].poster_path) return null;
  const [shorter, longer] = [searchTitle, titled[0].title].sort((a, b) => a.length - b.length);
  return shorter.length >= 4 && wholeWords(shorter, longer) ? results[0] : null;
}
