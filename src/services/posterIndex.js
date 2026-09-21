// The poster index: decisions made offline (scripts/build-poster-index.mjs) about which TMDB
// film an Archive.org upload is, keyed by Archive.org identifier. Archive.org metadata for an
// identifier does not change, so a decision is made once and shipped as a static file. It gives
// real posters without a TMDB key and without a burst of TMDB lookups per page.
//
// Entry shapes (kept short because the file is downloaded by every visitor):
//   { i: tmdbId, t: title, y: year, p: posterPath, v: voteAverage, c: confidence }
//   { n: 1, c: confidence }   decided: show the generated cover
// Add m: 1 to an entry corrected by hand; the build script never overwrites those.

// Every wrong poster seen so far was at 0.66 or below (80-upload pilot, then a read-through of the
// first 471 indexed posters), so 0.7 keeps unattended refreshes from adding wrong ones.
export const CONFIDENCE_THRESHOLD = 0.7;

let films = null; // identifier -> entry
let loading = null;

export function setPosterIndex(entries) {
  films = entries || {};
}

function load() {
  if (films) return Promise.resolve(films);
  loading = loading || fetch(`${import.meta.env?.BASE_URL || '/'}poster-index.json`)
    .then(response => (response.ok ? response.json() : {}))
    .then(index => { films = index.films || {}; return films; })
    .catch(() => { films = {}; return films; }); // the index is an optimisation; the app works without it
  return loading;
}

// undefined = not indexed (fall back to live matching), null = decided there is no poster
export async function indexedMatch(identifier) {
  if (!identifier) return undefined;
  const entry = (await load())[identifier];
  if (!entry) return undefined;
  if (entry.n) return null;
  return { id: entry.i, title: entry.t, posterPath: entry.p, releaseDate: entry.y ? String(entry.y) : '', voteAverage: entry.v, fromIndex: true };
}

// Films the index has a poster for come first; each group keeps the order it arrived in. The
// index answers from memory, so the batch is ordered before it is shown and no card moves later.
// ponytail: films matched live by TMDB (not in the index) stay where they are; resolving those
// first would hold every page back by a second or more.
export async function postersFirst(movies) {
  const matches = await Promise.all(movies.map(movie => indexedMatch(movie.identifier)));
  return [...movies.filter((_, i) => matches[i]), ...movies.filter((_, i) => !matches[i])];
}

// Used by the build script: turn a model decision into an index entry
export function decisionToEntry({ film, confidence }) {
  if (!film || !film.poster_path || confidence < CONFIDENCE_THRESHOLD) return { n: 1, c: confidence };
  return { i: film.id, t: film.title, y: Number((film.release_date || '').slice(0, 4)) || null, p: film.poster_path, v: film.vote_average, c: confidence };
}
