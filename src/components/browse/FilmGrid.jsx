import React, { useEffect, useRef, useState } from 'react';
import { Film, Loader2 } from 'lucide-react';
import MovieCard from '../MovieCard';
import tmdbService from '../../services/tmdb';
import { track } from '../../services/analytics';

// The films, and every state around them: the line that says what is showing, errors, the
// first-batch spinner, the grid or list, the empty state, the end of the list, and Load more.
// `films` is what useFilms returns; `browse` is useBrowseFilters.
export default function FilmGrid({ films, browse, viewMode, onOpen, linkError }) {
  const { movies, loading, error, nextPage, loadMore, retry } = films;
  const { filters, currentCategory, canWiden, widen } = browse;
  const { activeSearch, genre, contentType, minRuntime, decade, sort } = filters;

  // Load more keeps focus on the button and tells a screen reader how many arrived (#177)
  const loadMoreStart = useRef(null);
  const [loadMoreStatus, setLoadMoreStatus] = useState('');
  useEffect(() => {
    if (!loading && loadMoreStart.current !== null) {
      setLoadMoreStatus(`${movies.length - loadMoreStart.current} more films loaded`);
      loadMoreStart.current = null;
    }
  }, [loading, movies.length]);
  const handleLoadMore = () => {
    if (loading) return;
    loadMoreStart.current = movies.length;
    setLoadMoreStatus('');
    track('Load more', { page: nextPage });
    loadMore();
  };

  // A single collection can be small, so offer the wider look with the same filters
  const widenButton = <button onClick={widen} className="btn-ghost mt-3">Look in All Films instead</button>;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-muted">
        <span>
          Showing <strong className="text-bone">{movies.length}</strong>
          {' '}{contentType === 'trailers' ? 'shorts' : 'movies'}
          {genre !== 'all' && ` in ${genre}`}
          {!activeSearch && ` from ${currentCategory.name}`}
          {activeSearch && ` for "${activeSearch}" across all collections`}
        </span>
        {contentType !== 'trailers' && minRuntime > 0 && (
          <>
            <span className="text-line">|</span>
            <span title="Uploads that record no length are kept: about a third of the catalogue, and nearly every film from the 2020s. Trailers are left out by their titles and file sizes instead.">
              {minRuntime}+ min runtime{movies.length > 0 && movies.every(m => !m.runtimeMinutes) ? ' (no lengths recorded for these)' : ''}
            </span>
          </>
        )}
        {decade && <><span className="text-line">|</span><span>{decade}s</span></>}
        {sort.startsWith('date') && (
          <><span className="text-line">|</span><span>Films with a known release date. Uploads dated the year they were uploaded are left out: that date is usually not the film's.</span></>
        )}
        {tmdbService.apiKey && <><span className="text-line">|</span><span className="text-nitrate">Posters on</span></>}
      </div>

      {linkError && <div role="alert" className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6 text-red-300">{linkError}</div>}

      {error && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
          <p className="text-red-300">Error: {error}</p>
          <button onClick={retry} className="mt-2 text-sm text-red-400 hover:text-red-300 underline">Try again</button>
        </div>
      )}

      {/* First batch only: Load more keeps the grid visible */}
      {loading && movies.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-signal" />
          <span className="ml-3 text-lg">Loading movies from Archive.org...</span>
        </div>
      )}

      {movies.length > 0 && (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4' : 'space-y-3'}>
          {movies.map((movie) => <MovieCard key={movie.identifier} movie={movie} viewMode={viewMode} onPlay={onOpen} />)}
        </div>
      )}

      {!loading && movies.length === 0 && !error && (
        <div className="text-center py-16 text-muted">
          <Film className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No movies found matching your criteria</p>
          <p className="text-sm mt-2">Try adjusting the filters or search query</p>
          {canWiden && widenButton}
        </div>
      )}

      {/* The end of the list says so, or a short list looks like broken paging */}
      {!loading && !nextPage && !error && movies.length > 0 && (
        <div className="text-center mt-8 pt-8 border-t border-line text-muted">
          <p>That's all {movies.length}{!activeSearch && ` in ${currentCategory.name}`} for these filters.</p>
          {canWiden && widenButton}
        </div>
      )}

      {nextPage && !error && (movies.length > 0 || !loading) && (
        <div className="flex justify-center mt-8 pt-8 border-t border-line">
          <button onClick={handleLoadMore} aria-disabled={loading} className="btn-primary btn-lg aria-disabled:opacity-50">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Loading...' : 'Load more'}
          </button>
          <span className="sr-only" aria-live="polite">{loadMoreStatus}</span>
        </div>
      )}
    </>
  );
}
