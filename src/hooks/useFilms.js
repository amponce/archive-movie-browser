import { useState, useEffect, useCallback, useRef } from 'react';
import archiveService, { runtimeFilter, betterCopy } from '../services/archive';
import tmdbService from '../services/tmdb';
import { postersFirst, oneCopyPerFilm, loadPosterIndex, withIndexedLength } from '../services/posterIndex';
import { apiSort, orderBatch } from '../services/sorting';
import { browsesIndex, indexFilms, pageOf } from '../services/indexBrowse';

const FIRST = { from: 'archive', page: 1 };

// The list of films for a set of filters, and "Load more". Fetching from the start whenever the
// filters change; appending for later pages; ignoring responses that arrive after a newer request.
// A genre browse is answered from the poster index first (it knows every identified film's genre,
// Archive.org only knows the tagged ones), then continues into Archive.org's own results.
export default function useFilms({ search, sort, genre, collection, decade, contentType, minRuntime }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextPage, setNextPage] = useState(null); // { from: 'index' | 'archive', page }, null when exhausted

  // Only the latest request may update state (older responses can arrive last)
  const latestRequest = useRef(0);
  // Titles already shown, so the same film isn't repeated across batches
  const seenTitles = useRef(new Set());
  // Films (index ids) already shown: two uploads of one film get one card
  const seenFilms = useRef(new Set());

  // The first page replaces the list, later pages append
  const fetchPage = useCallback(async (target = FIRST) => {
    const requestId = ++latestRequest.current;
    const fromIndex = browsesIndex({ search, genre, collection, sort });
    let { from, page: startPage } = target === FIRST && fromIndex ? { from: 'index', page: 1 } : target;
    const append = !(startPage === 1 && from === (fromIndex ? 'index' : 'archive'));
    if (!append) {
      seenTitles.current = new Set();
      seenFilms.current = new Set();
      setMovies([]);
    }
    setLoading(true);
    setError(null);

    try {
      if (from === 'index') {
        const index = await loadPosterIndex();
        if (requestId !== latestRequest.current) return;
        const all = indexFilms(index, { genre, decade, shorts: contentType === 'trailers', minRuntime, sort });
        const { movies: batch, more } = pageOf(all, startPage);
        for (const movie of batch) seenFilms.current.add(index[movie.identifier].i);
        if (batch.length) {
          setMovies(prev => (append ? [...prev, ...batch] : batch));
          setNextPage(more ? { from: 'index', page: startPage + 1 } : { from: 'archive', page: 1 });
          return;
        }
        // Nothing left in the index (or a genre it does not know): straight on to Archive.org
        from = 'archive'; startPage = 1;
      }

      await loadPosterIndex(); // its measured lengths stand in where Archive.org's search has none
      if (requestId !== latestRequest.current) return;
      const runtime = runtimeFilter({ shorts: contentType === 'trailers', minRuntime });
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
        filter: movie => runtime(withIndexedLength(movie)),
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
      setNextPage(result.nextPage ? { from: 'archive', page: result.nextPage } : null);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(err.message);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [search, sort, genre, collection, decade, contentType, minRuntime]);

  // Fetch from the start whenever filters change
  useEffect(() => {
    fetchPage(FIRST);
  }, [fetchPage]);

  const loadMore = useCallback(() => { if (nextPage) fetchPage(nextPage); }, [fetchPage, nextPage]);
  // After an error: carry on from where the list stopped, or start over if there is nothing yet
  const retry = useCallback(() => fetchPage(movies.length > 0 && nextPage ? nextPage : FIRST), [fetchPage, movies.length, nextPage]);

  return { movies, loading, error, nextPage, loadMore, retry };
}
