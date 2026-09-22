// The tools, kept apart from the transport so they can be tested without starting a server.
// All Archive.org logic comes from the web app's services (src/services), which have no browser
// dependencies: search across collections, de-duplication of re-uploads, runtime parsing, retries.
import { readFileSync } from 'node:fs';
import archiveService, { VIDEO_CATEGORIES, STANDARD_GENRES, DECADES, ALL_FILMS, runtimeFilter, defaultMinRuntime } from '../src/services/archive.js';
import { setPosterIndex, indexedMatch } from '../src/services/posterIndex.js';

const index = JSON.parse(readFileSync(new URL('../public/poster-index.json', import.meta.url)));
setPosterIndex(index.films);

export const SORTS = ['downloads', 'avg_rating', 'date desc', 'date asc', 'publicdate desc', 'title asc'];
const SITE = 'https://www.orphanedfilms.com';

// What a client gets for a film. Two links, ours first: watchUrl plays the film with this
// project's player, real title and poster; sourceUrl is the original Archive.org page.
export async function describe(movie) {
  const film = await indexedMatch(movie.identifier); // undefined = not indexed, null = decided "no match"
  return {
    watchUrl: `${SITE}/browse#${movie.identifier}`,
    sourceUrl: movie.archiveUrl,
    title: film?.title || movie.title,
    uploadTitle: movie.title,
    year: (film?.releaseDate && Number(film.releaseDate)) || movie.year || null,
    runtimeMinutes: Math.round(movie.runtimeMinutes) || null,
    genres: movie.genres,
    downloads: Number(movie.downloads) || null, // the single-item endpoint does not report downloads
    identifier: movie.identifier,
    posterUrl: film?.posterPath ? `https://image.tmdb.org/t/p/w500${film.posterPath}` : null,
    tmdbId: film?.id ?? null,
  };
}

async function list(options, limit) {
  const { movies, total } = await archiveService.fetchFiltered({ ...options, count: limit, maxPages: 3, retryDelayMs: 600 });
  return { total, films: await Promise.all(movies.slice(0, limit).map(describe)) };
}

export const searchFilms = ({ query, limit = 10 }) =>
  list({ searchQuery: query, filter: runtimeFilter({ minRuntime: 0 }) }, limit);

export const browseFilms = ({ collection = 'feature_films', genre, decade, sort = 'downloads', minRuntime, limit = 10 }) =>
  list({
    collection,
    decade,
    genre: genre || null,
    sortBy: sort.split(' ')[0],
    sortOrder: sort.split(' ')[1] || 'desc',
    filter: runtimeFilter({ minRuntime: minRuntime ?? defaultMinRuntime(collection) }),
  }, limit);

export async function getFilm({ identifier }) {
  const movie = await archiveService.getMovieByIdentifier(identifier);
  return { ...(await describe(movie)), embedUrl: movie.embedUrl, description: String(movie.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200), creator: movie.creator || null };
}

export const listCollections = () => ({
  collections: [{ id: ALL_FILMS, name: 'All Films', films: true }, ...VIDEO_CATEGORIES.map(({ id, name, films }) => ({ id, name, films: Boolean(films) }))],
  genres: STANDARD_GENRES,
  sorts: SORTS,
  decades: DECADES,
});

// Television: what every channel is showing right now, and what is next. Same schedule the
// site and the M3U use, from ../api/_tv.js.
export async function whatsOn({ channel } = {}) {
  const { schedule } = await import('../api/_tv.js');
  const { channels } = schedule({ hours: 3 });
  const wanted = channel ? channels.filter(c => c.number === Number(channel) || c.id === String(channel)) : channels;
  if (!wanted.length) return { channels: [], note: `No channel ${channel}. Channels are numbered 1 to ${channels.length}.` };
  return {
    guideUrl: `${SITE}/tv`,
    playlistUrl: `${SITE}/api/tv/playlist.m3u`,
    channels: wanted.map(c => ({
      number: c.number,
      name: c.name,
      tuneInUrl: `${SITE}/tv#${c.id}`,
      now: c.now && { title: c.now.film.title, year: c.now.film.year, minutesIn: Math.floor(c.now.offset / 60), endsAt: new Date(c.now.endsAt).toISOString(), watchUrl: `${SITE}/browse#${encodeURIComponent(c.now.film.id)}` },
      next: c.programmes.slice(1, 3).map(p => ({ title: p.title, year: p.year, startsAt: new Date(p.startsAt).toISOString() })),
    })),
  };
}

export { DECADES };
export const COLLECTION_IDS = [ALL_FILMS, ...VIDEO_CATEGORIES.map(c => c.id)]; // 'all' = every film collection
