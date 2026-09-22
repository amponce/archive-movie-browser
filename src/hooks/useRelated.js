import { useEffect, useState } from 'react';
import archiveService, { ALL_FILMS, runtimeFilter } from '../services/archive';
import { indexedMatch } from '../services/posterIndex';

// "More like this" for a film: the most-watched films that share its first real genre, with
// the ones the index has a poster for first. Its own request, so it works however the film
// was opened (browse, a list, a link) and does not depend on what the browser has loaded.
// `fallback` (the browser's current list) fills in while it loads or if Archive.org is down.
// `hints` are genre names from elsewhere (TMDB) for uploads Archive.org tagged with nothing.
export default function useRelated(movie, fallback = [], hints = []) {
  const genre = movie?.genres?.find(g => g !== 'Uncategorized')
    || hints.map(name => archiveService.normalizeGenre(name)).find(Boolean)
    || null;
  const [films, setFilms] = useState([]);

  useEffect(() => {
    if (!movie) return undefined;
    let cancelled = false;
    setFilms([]);
    archiveService.fetchMovies({ collection: ALL_FILMS, genre, sortBy: 'downloads', sortOrder: 'desc', rowsPerPage: 60 })
      .then(async ({ movies }) => {
        const pool = movies.filter(m => m.identifier !== movie.identifier).filter(runtimeFilter({ minRuntime: 40 }));
        const matches = await Promise.all(pool.map(m => indexedMatch(m.identifier)));
        const seen = new Set();
        const withPoster = [];
        const without = [];
        pool.forEach((m, i) => {
          const match = matches[i];
          if (match?.posterPath) { if (!seen.has(match.id)) { seen.add(match.id); withPoster.push(m); } }
          else if (match !== null) without.push(m); // undefined = unknown, may still find one live
        });
        if (!cancelled) setFilms([...withPoster, ...without].slice(0, 12));
      })
      .catch(() => { /* keep the fallback */ });
    return () => { cancelled = true; };
  }, [movie?.identifier, genre]);

  if (films.length) return { films, genre };
  return { films: fallback.filter(m => m.identifier !== movie?.identifier && (!genre || m.genres?.includes(genre))).slice(0, 12), genre };
}
