// The poster index: decisions made offline (scripts/build-poster-index.mjs) about which TMDB
// film an Archive.org upload is, keyed by Archive.org identifier. Archive.org metadata for an
// identifier does not change, so a decision is made once and shipped as a static file. It gives
// real posters without a TMDB key and without a burst of TMDB lookups per page.
//
// Entry shapes (kept short because the file is downloaded by every visitor):
//   { i: tmdbId, t: title, y: year, p: posterPath, v: voteAverage, c: confidence }
//   { n: 1, c: confidence }   decided: show the generated cover
// Add m: 1 to an entry corrected by hand; the build script never overwrites those.
// r: 1 marks a 'none' that was decided again with extra candidates (--retry-none) and stayed none.

// Every wrong poster seen so far was at 0.66 or below (80-upload pilot, then a read-through of the
// first 471 indexed posters), so 0.7 keeps unattended refreshes from adding wrong ones.
export const CONFIDENCE_THRESHOLD = 0.7;

let films = null; // identifier -> entry
let loading = null;

export function setPosterIndex(entries) {
  films = entries || {};
}

// The whole index, loaded once per page. Pages that read it directly (the front page, the reel)
// share this so it is fetched once.
export function loadPosterIndex() { return load(); }

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
  return { id: entry.i, title: entry.t, posterPath: entry.p, releaseDate: entry.y ? String(entry.y) : '', voteAverage: entry.v, fromIndex: true, confidence: entry.c };
}

// Films the index has a poster for come first; each group keeps the order it arrived in. The
// index answers from memory, so the batch is ordered before it is shown and no card moves later.
// ponytail: films matched live by TMDB (not in the index) stay where they are; resolving those
// first would hold every page back by a second or more. Goes away once the whole catalogue is
// indexed and nothing is matched live.
// One card per film: when the index says two uploads are the same film, keep the better copy
// in the earlier one's place. `seen` carries the films already on screen across "Load more".
export async function oneCopyPerFilm(movies, seen = new Set(), better = (a) => a) {
  const matches = await Promise.all(movies.map(movie => indexedMatch(movie.identifier)));
  const slot = new Map(); // film id -> position in `out`
  const out = [];
  movies.forEach((movie, i) => {
    const id = matches[i]?.id;
    if (!id) { out.push(movie); return; }
    if (seen.has(id)) return;
    if (slot.has(id)) { out[slot.get(id)] = better(out[slot.get(id)], movie); return; }
    slot.set(id, out.length);
    out.push(movie);
  });
  for (const id of slot.keys()) seen.add(id);
  return out;
}

export async function postersFirst(movies) {
  const matches = await Promise.all(movies.map(movie => indexedMatch(movie.identifier)));
  return [...movies.filter((_, i) => matches[i]), ...movies.filter((_, i) => !matches[i])];
}

// The moment worth showing: the index decided this upload is a film whose name is not the
// upload's name ("Dead People" is Messiah of Evil). Null when there is nothing to reveal.
export function identifiedAs(movie, match) {
  // Only a confident decision is worth announcing: the 0.7-0.8 band holds most of the rare misses
  if (!match?.fromIndex || !match.title || !(match.confidence >= 0.8)) return null;
  const words = (text) => String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (words(movie.title).includes(words(match.title))) return null;
  return { uploadTitle: movie.title, confidence: match.confidence };
}

// Used by the build script: turn a model decision into an index entry
export function decisionToEntry({ film, confidence }) {
  if (!film || !film.poster_path || confidence < CONFIDENCE_THRESHOLD) return { n: 1, c: confidence };
  const entry = { i: film.id, t: film.title, y: Number((film.release_date || '').slice(0, 4)) || null, p: film.poster_path, v: film.vote_average, c: confidence };
  // The original title, when it differs: uploads and searches often use it ("Zombi Holocaust")
  if (film.original_title && film.original_title !== film.title) entry.o = film.original_title;
  return entry;
}
