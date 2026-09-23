import { useEffect, useState } from 'react';
import archiveService, { ALL_FILMS, runtimeFilter } from '../services/archive';
import { indexedMatch, loadPosterIndex } from '../services/posterIndex';
import { sameShelf } from '../services/programme';
import tmdbService from '../services/tmdb';
import { isRecent } from '../services/policy';

// "More like this" for a film: the most-watched films that share its first real genre. Only
// films the index identified (a TMDB match with a poster): the site never puts an unidentified
// upload in front of people on its own. Its own request, so it works however the film was
// opened (browse, a list, a link) and does not depend on what the browser has loaded.
// `hints` are genre names from elsewhere (TMDB) for uploads Archive.org tagged with nothing.
// A film the index knows (with genres) gets its shelf from the index, no request. The rest ask
// Archive.org for the genre's most-watched, which is only as good as the uploader's tag.
export default function useRelated(movie, hints = []) {
  const genre = movie?.genres?.find(g => g !== 'Uncategorized')
    || hints.map(name => archiveService.normalizeGenre(name)).find(Boolean)
    || null;
  const [films, setFilms] = useState([]);

  useEffect(() => {
    if (!movie) return undefined;
    let cancelled = false;
    setFilms([]);
    const fetchFromArchive = () => archiveService.fetchMovies({ collection: ALL_FILMS, genre, sortBy: 'downloads', sortOrder: 'desc', rowsPerPage: 60 })
      .then(async ({ movies }) => {
        const pool = movies.filter(m => m.identifier !== movie.identifier).filter(runtimeFilter({ minRuntime: 40 }));
        const matches = await Promise.all(pool.map(m => indexedMatch(m.identifier)));
        const seen = new Set();
        const identified = [];
        pool.forEach((m, i) => {
          const match = matches[i];
          if (match?.posterPath && !seen.has(match.id) && !isRecent(match.releaseDate)) { seen.add(match.id); identified.push(m); }
        });
        if (!cancelled) setFilms(identified.slice(0, 12));
      })
      .catch(() => { /* no shelf */ });
    loadPosterIndex().then(index => {
      if (cancelled) return;
      const shelf = sameShelf(index, movie.identifier);
      if (shelf) {
        setFilms(shelf.map(({ id, entry }) => ({ identifier: id, title: entry.t, year: entry.y, genres: entry.g, posterPath: entry.p, poster: tmdbService.getPosterUrl(entry.p, 'small') })));
        return;
      }
      fetchFromArchive();
    });
    return () => { cancelled = true; };
  }, [movie?.identifier, genre]);

  return { films, genre };
}
