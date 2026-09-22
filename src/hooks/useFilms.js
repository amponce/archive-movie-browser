import { useState, useEffect, useCallback, useRef } from 'react';
import archiveService, { runtimeFilter, betterCopy } from '../services/archive';
import tmdbService from '../services/tmdb';
import { postersFirst, oneCopyPerFilm } from '../services/posterIndex';
import { apiSort, orderBatch } from '../services/sorting';

// The list of films for a set of filters, and "Load more". Fetching from the start whenever the
// filters change; appending for later pages; ignoring responses that arrive after a newer request.
export default function useFilms({ search, sort, genre, collection, decade, contentType, minRuntime }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextPage, setNextPage] = useState(null); // next Archive.org page to load, null when exhausted

  // Only the latest request may update state (older responses can arrive last)
  const latestRequest = useRef(0);
  // Titles already shown, so the same film isn't repeated across batches
  const seenTitles = useRef(new Set());
  // Films (index ids) already shown: two uploads of one film get one card
  const seenFilms = useRef(new Set());

  // startPage 1 replaces the list, later pages append
  const fetchPage = useCallback(async (startPage = 1) => {
    const requestId = ++latestRequest.current;
    const append = startPage > 1;
    if (!append) {
      seenTitles.current = new Set();
      seenFilms.current = new Set();
      setMovies([]);
    }
    setLoading(true);
    setError(null);

    try {
      // Filters run inside the service so every batch comes back full
      const result = await archiveService.fetchFiltered({
        searchQuery: search,
        ...apiSort(sort),
        startPage,
        genre: genre !== 'all' ? genre : null,
        collection,
        decade,
        seenTitles: seenTitles.current,
        // The server query already applied the genre, so only runtime is checked here
        filter: runtimeFilter({ shorts: contentType === 'trailers', minRuntime }),
      });
      if (requestId !== latestRequest.current) return;

      const unique = await oneCopyPerFilm(result.movies, seenFilms.current, betterCopy);
      if (requestId !== latestRequest.current) return;

      const batch = await orderBatch(unique, sort, {
        byRating: (films) => tmdbService.sortByRating(films),
        withPosters: postersFirst,
      });
      if (requestId !== latestRequest.current) return;

      setMovies(prev => (append ? [...prev, ...batch] : batch));
      setNextPage(result.nextPage);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(err.message);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [search, sort, genre, collection, decade, contentType, minRuntime]);

  // Fetch from the start whenever filters change
  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const loadMore = useCallback(() => { if (nextPage) fetchPage(nextPage); }, [fetchPage, nextPage]);
  // After an error: carry on from where the list stopped, or start over if there is nothing yet
  const retry = useCallback(() => fetchPage(movies.length > 0 && nextPage ? nextPage : 1), [fetchPage, movies.length, nextPage]);

  return { movies, loading, error, nextPage, loadMore, retry };
}
