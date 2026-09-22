// What fills a row of film cards on the front page. Each function returns cards
// ({ id, title, year, genre, poster }) and only ever cards with a poster: the front page
// shows posters or nothing.
import archiveService, { ALL_FILMS, runtimeFilter } from './archive';
import tmdbService from './tmdb';
import { indexedMatch } from './posterIndex';

export const cardFromIndex = ({ id, entry }) => ({ id, title: entry.t, year: entry.y, poster: tmdbService.getPosterUrl(entry.p, 'medium') });

const cardFromArchive = (movie, posterPath) => ({
  id: movie.identifier,
  title: movie.title,
  year: movie.year,
  genre: movie.genres?.find(g => g !== 'Uncategorized') || null,
  poster: tmdbService.getPosterUrl(posterPath, 'medium'),
});

// Keep the uploads the index has a poster for, one per film, in the order given
async function withIndexedPosters(movies, limit) {
  const matches = await Promise.all(movies.map(m => indexedMatch(m.identifier)));
  const seen = new Set();
  const cards = [];
  movies.forEach((movie, i) => {
    const match = matches[i];
    if (!match?.posterPath || seen.has(match.id)) return;
    seen.add(match.id);
    cards.push(cardFromArchive(movie, match.posterPath));
  });
  return cards.slice(0, limit);
}

// The most-watched feature films of a genre, from the index
export async function popularRow({ genre, limit = 12 }) {
  const { movies } = await archiveService.fetchMovies({ collection: ALL_FILMS, genre, sortBy: 'downloads', sortOrder: 'desc', rowsPerPage: 80 });
  return withIndexedPosters(movies.filter(runtimeFilter({ minRuntime: 40 })), limit);
}

// The newest feature-length uploads. Too new for the index, so posters are matched live
// (cached in the browser for a week) and only films that get one are shown.
// ponytail: up to 100 TMDB lookups per new visitor, and a first paint that waits on them;
// a nightly index run over recent uploads makes this a file read like every other row.
export async function newestRow({ limit = 6 } = {}) {
  const { movies } = await archiveService.fetchMovies({ collection: ALL_FILMS, sortBy: 'publicdate', sortOrder: 'desc', rowsPerPage: 100 });
  const features = movies.filter(runtimeFilter({ minRuntime: 40 }));
  const seen = new Set();
  const cards = [];
  for (let i = 0; i < features.length && cards.length < limit; i += 8) {
    const batch = features.slice(i, i + 8);
    const found = await Promise.all(batch.map(m => tmdbService.searchMovie(m.title, m.year, m.identifier).catch(() => null)));
    batch.forEach((movie, j) => {
      const hit = found[j];
      if (!hit?.posterPath || seen.has(hit.id) || cards.length >= limit) return;
      seen.add(hit.id);
      cards.push(cardFromArchive(movie, hit.posterPath));
    });
  }
  return cards;
}
