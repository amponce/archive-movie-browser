import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Film,
  Clock,
  Filter,
  Loader2,
  Settings,
  Grid,
  List,
  SlidersHorizontal,
  Library,
  ChevronDown,
  Calendar,
} from 'lucide-react';
import archiveService, { STANDARD_GENRES, VIDEO_CATEGORIES, BROWSABLE_COLLECTIONS, DECADES, ALL_FILMS, defaultMinRuntime, collectionChoice } from '../services/archive';
import tmdbService from '../services/tmdb';
import { parseArchiveUrl } from '../services/archiveUrl';
import { parseFilters, filtersToQuery, SORT_OPTIONS, RUNTIME_OPTIONS } from '../services/urlFilters';
import { track } from '../services/analytics';
import useFilms from '../hooks/useFilms';
import MovieCard from './MovieCard';
import SearchBox from './SearchBox';
import SettingsModal from './SettingsModal';
import MovieDetailPage from './MovieDetailPage';
import McpBanner from './McpBanner';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';

const VIEW_MODE_KEY = 'view-mode';

// Grid or list is a personal preference, so it lives in localStorage rather than the URL
function readViewMode() {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid'; // storage can throw in private mode
  }
}

export default function ArchiveMovieBrowser() {
  // Settings & UI state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [viewMode, setViewMode] = useState(readViewMode);

  const changeViewMode = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* private mode */ }
  };

  // A #identifier in the URL opens that film: on load (a shared link), and whenever the hash
  // changes while the page is open (Spin the reel, a link from the header's search).
  useEffect(() => {
    let cancelled = false;
    const openFromHash = () => {
      const identifier = window.location.hash.slice(1);
      if (!identifier) return;
      let decoded;
      try { decoded = decodeURIComponent(identifier); } catch { decoded = identifier; }
      if (selectedRef.current?.identifier === decoded) return;
      archiveService.getMovieByIdentifier(decoded)
        .then((movie) => { if (!cancelled) setSelectedMovie(movie); })
        .catch((err) => { if (!cancelled) console.error('Failed to open movie from URL hash:', err); });
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => { cancelled = true; window.removeEventListener('hashchange', openFromHash); };
  }, []);

  // The film page closes through history.back(), and that popstate also restores the filters
  // from the URL. So a search made from the film page waits until the close has happened;
  // applied any earlier, the restore would undo it.
  const afterClose = useRef(null);
  const closeFilmThen = (action) => {
    afterClose.current = action;
    window.history.back();
  };

  // Every way of opening a film (card, link, search, related) ends up here
  useEffect(() => {
    if (selectedMovie) track('Film opened', { film: selectedMovie.identifier, title: selectedMovie.title });
  }, [selectedMovie?.identifier]);

  // A pasted archive.org/details/<identifier> link opens the film here
  const [linkError, setLinkError] = useState(null);
  const selectedRef = useRef(null); // what popstate sees without re-subscribing
  selectedRef.current = selectedMovie;
  const openFilmLink = (identifier) => {
    setLinkError(null);
    archiveService.getMovieByIdentifier(identifier)
      .then(setSelectedMovie)
      .catch(() => setLinkError(`Couldn't open that Archive.org link. Check the address: nothing was found at "${identifier}".`));
  };

  // TMDB API key from environment variable only
  const tmdbApiKey = tmdbService.apiKey;

  // Data state

  // Filter state, initialised from the URL so shared views reload intact (#43)
  const [urlFilters] = useState(() => parseFilters(window.location.search));
  const [searchQuery, setSearchQuery] = useState(urlFilters.q);
  const [activeSearch, setActiveSearch] = useState(urlFilters.q);
  const [genreFilter, setGenreFilter] = useState(urlFilters.genre);
  const [minRuntime, setMinRuntime] = useState(urlFilters.runtime);
  const [contentType, setContentType] = useState(urlFilters.type); // 'features' or 'trailers'
  const [sortBy, setSortBy] = useState(urlFilters.sort);
  const [decade, setDecade] = useState(urlFilters.decade);
  const [category, setCategory] = useState(urlFilters.collection); // Video collection/category

  // Get current category info
  const currentCategory = VIDEO_CATEGORIES.find(c => c.id === category)
    || { id: ALL_FILMS, name: 'All Films', description: 'Every film collection on the Internet Archive' };
  // Only a search looks outside the chosen collection; the genre pills narrow it
  const acrossCollections = Boolean(activeSearch);
  const collectionDescription = activeSearch
    ? 'Search results across all collections'
    : genreFilter !== 'all'
      ? `${genreFilter} in ${currentCategory.name}`
      : currentCategory.description;

  const { movies, loading, error, nextPage, loadMore, retry } = useFilms({
    search: activeSearch, sort: sortBy, genre: genreFilter, collection: category, decade, contentType, minRuntime,
  });
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

  // Handle search submit
  const handleSearch = (text = searchQuery) => {
    // An Archive.org link opens what it points at instead of being searched for as words
    const link = parseArchiveUrl(text);
    if (link?.type === 'film') {
      setSearchQuery('');
      track('Search', { kind: 'pasted link' });
      return openFilmLink(link.identifier);
    }
    if (link?.type === 'collection') return handleCategoryChange(link.id);
    if (link?.type === 'search') text = link.query;
    setLinkError(null);
    if (text.trim()) track('Search', { query: text, kind: link ? 'pasted link' : 'typed' });
    setSearchQuery(text);
    setActiveSearch(text.trim());
    setGenreFilter('all');
  };

  // Handle genre filter change
  const handleGenreChange = (genre) => {
    track('Filter', { type: 'genre', value: genre });
    setGenreFilter(genre);
  };

  // Handle sort change
  const handleSortChange = (newSort) => {
    track('Filter', { type: 'sort', value: newSort });
    setSortBy(newSort);
  };

  // Handle category change
  const handleCategoryChange = (chosen) => {
    // A genre-named collection (from a pasted Archive.org link) means All Films and its pill
    const { collection: newCategory, genre } = collectionChoice(chosen);
    // The site lands on the Horror pill; picking another library shows all of it (the pill
    // visibly moves to All Genres) rather than a near-empty "horror cartoons"
    setGenreFilter(genre || 'all');
    track('Filter', { type: 'collection', value: newCategory });
    setCategory(newCategory);
    // Cartoons, Prelinger films and most uploads are short or have no runtime, so only
    // feature-film collections start on the 40+ minute filter
    setContentType('features');
    setMinRuntime(defaultMinRuntime(newCategory));
    // Searches span all collections, so picking one means going back to browsing it
    setSearchQuery('');
    setActiveSearch('');
  };

  // Rebuild the query string from filter state, omitting defaults and keeping the
  // existing #identifier hash so film links and query filters coexist (#43).
  const urlSynced = useRef(false); // false until the arrival URL has been tidied
  const writeFiltersToUrl = (mode) => {
    const query = filtersToQuery({
      collection: category,
      genre: genreFilter,
      q: activeSearch,
      decade,
      sort: sortBy,
      runtime: minRuntime,
      type: contentType,
    });
    const currentSearch = window.location.search.replace(/^\?/, '');
    // Already in sync: nothing to write. This also makes the sync effects safe on
    // mount and when popstate has just restored the state (no history spam).
    if (query === currentSearch) return;

    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (mode === 'push' && urlSynced.current) window.history.pushState({}, '', url);
    else window.history.replaceState({}, '', url);
  };

  // Deliberate changes (collection, genre, search) add a history entry so Back
  // returns to the previous view; minor ones only rewrite the current entry.
  useEffect(() => {
    writeFiltersToUrl('push');
    urlSynced.current = true;
  }, [category, genreFilter, activeSearch, decade]);

  useEffect(() => {
    writeFiltersToUrl('replace');
  }, [sortBy, minRuntime, contentType]);

  // Back/Forward between filter views: restore the state from the URL. Forward can also land on
  // a film's history entry (open a film, Back, Forward): reopen it, or the film URL would sit on
  // a browse page and leak into the next film opened.
  useEffect(() => {
    const onPopState = (event) => {
      const identifier = event.state?.movieDetail && event.state.identifier;
      if (identifier && !selectedRef.current) openFilmLink(identifier);
      const restored = parseFilters(window.location.search);
      setCategory(restored.collection);
      setGenreFilter(restored.genre);
      setActiveSearch(restored.q);
      setSearchQuery(restored.q);
      setSortBy(restored.sort);
      setDecade(restored.decade);
      setMinRuntime(restored.runtime);
      setContentType(restored.type);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Genre row scroll: auto-scroll selected pill into view and track end-of-row
  const genreRowRef = useRef(null);
  const [genreRowAtEnd, setGenreRowAtEnd] = useState(false);

  // Scroll the selected pill to the centre of the row. Only acts when the row
  // is in scrollable/mobile mode (scrollWidth > clientWidth); on desktop the
  // pills wrap so there is nothing to scroll.
  const scrollSelectedPillIntoView = useCallback(() => {
    const row = genreRowRef.current;
    if (!row) return;
    // Skip on desktop: pills wrap so the row is not scrollable
    if (row.scrollWidth <= row.clientWidth) return;
    const pressed = row.querySelector('[aria-pressed="true"]');
    if (pressed) {
      // Move the row itself: scrollIntoView would also scroll the page when the row is
      // off screen (rotating the phone deep in the list jumped back to the top)
      const pill = pressed.getBoundingClientRect();
      const box = row.getBoundingClientRect();
      row.scrollLeft += pill.left - box.left - (box.width - pill.width) / 2;
    }
  }, []);

  // Re-scroll when the selected genre changes (covers initial load from URL
  // and every manual pill click).
  useEffect(() => {
    scrollSelectedPillIntoView();
  }, [genreFilter, scrollSelectedPillIntoView]);

  // Re-scroll when the row is resized — this covers the desktop→mobile
  // transition: the row switches from wrapped to scrollable, so the selected
  // pill may suddenly be off-screen.
  useEffect(() => {
    const row = genreRowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(scrollSelectedPillIntoView);
    observer.observe(row);
    return () => observer.disconnect();
  }, [scrollSelectedPillIntoView]);

  // Hide the right-edge fade once the row has been scrolled to its end.
  useEffect(() => {
    const row = genreRowRef.current;
    if (!row) return;
    const update = () => {
      setGenreRowAtEnd(row.scrollLeft + row.clientWidth >= row.scrollWidth - 1);
    };
    row.addEventListener('scroll', update, { passive: true });
    update(); // run once on mount
    return () => row.removeEventListener('scroll', update);
  }, []);


  // A single collection can be small (Sci-Fi & Horror has 51 films from the 1980s; all the
  // film collections together have 5,300), so offer the wider look with the same filters.
  const canWiden = !activeSearch && category !== ALL_FILMS;
  const widenButton = (
    <button
      onClick={() => { track('Filter', { type: 'collection', value: 'all (widened)' }); setCategory(ALL_FILMS); }}
      className="btn-ghost mt-3"
    >
      Look in All Films instead
    </button>
  );

  return (
    <div className="min-h-screen">
      <McpBanner />
      <SiteHeader
        current="/browse"
        search={(
          <SearchBox
            value={searchQuery}
            onChange={(text) => {
              setSearchQuery(text);
              // Emptying the box ends the search
              if (text === '') setActiveSearch('');
            }}
            onSearch={handleSearch}
            onOpenFilm={(film) => (film.fromIndex ? archiveService.getMovieByIdentifier(film.identifier).then(setSelectedMovie).catch(() => {}) : setSelectedMovie(film))}
            onPickGenre={(genre) => {
              setSearchQuery('');
              setActiveSearch('');
              handleGenreChange(genre);
            }}
            onPickCollection={handleCategoryChange}
            movies={movies}
            loading={loading}
          />
        )}
      >
        <div className="gutter py-3 border-t border-line bg-ink/95 backdrop-blur sticky top-0 z-40">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="label">{collectionDescription}</p>
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex bg-panel border border-line rounded-full p-1">
                  <button
                    onClick={() => changeViewMode('grid')}
                    className={`p-2 rounded-full ${viewMode === 'grid' ? 'bg-bone text-ink' : 'text-muted hover:text-bone'}`}
                    title="Grid view"
                    aria-label="Grid view"
                    aria-pressed={viewMode === 'grid'}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => changeViewMode('list')}
                    className={`p-2 rounded-full ${viewMode === 'list' ? 'bg-bone text-ink' : 'text-muted hover:text-bone'}`}
                    title="List view"
                    aria-label="List view"
                    aria-pressed={viewMode === 'list'}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {/* Settings button */}
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="p-2 rounded-full border border-line text-muted hover:text-bone hover:border-bone"
                  title="About the posters"
                  aria-label="About the posters"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mobile disclosure keeps active choices visible without a tall sticky header. */}
            <button
              className="md:hidden flex items-center gap-2 w-full text-left text-xs text-muted"
              aria-expanded={filtersOpen}
              aria-controls="catalogue-filters"
              onClick={() => setFiltersOpen(open => !open)}
            >
              <Filter className="w-4 h-4 shrink-0" />
              <span className="flex-1">Filters: {acrossCollections ? 'All collections' : currentCategory.name} · {contentType === 'trailers' ? 'Shorts, ≤30 min' : `Full Movies, ${minRuntime ? `${minRuntime}+ min` : 'any length'}`} · {decade ? `${decade}s · ` : ''}{SORT_OPTIONS[sortBy]}</span>
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Filters row */}
            <div id="catalogue-filters" className={`${filtersOpen ? 'flex' : 'hidden'} md:flex flex-wrap gap-2`}>
              {/* Category/Collection dropdown */}
              <div className="control">
                <Library className="w-4 h-4 hidden sm:block" />
                <select
                  value={activeSearch ? 'search' : category}
                  aria-label="Collection"
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  {/* A search looks everywhere, so say so rather than keep showing a collection */}
                  {activeSearch && <option value="search" disabled>Everything (searching)</option>}
                  <option value={ALL_FILMS}>All Films</option>
                  {BROWSABLE_COLLECTIONS.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Content type toggle */}
              <div className="seg">
                <button
                  onClick={() => {
                    setContentType('features');
                    setMinRuntime(defaultMinRuntime(category));
                  }}
                  aria-pressed={contentType === 'features'}
                >
                  Full Movies
                </button>
                <button
                  onClick={() => {
                    setContentType('trailers');
                    setMinRuntime(0);
                  }}
                  aria-pressed={contentType === 'trailers'}
                >
                  Shorts
                </button>
              </div>

              {/* Runtime filter. Shorts are hard-capped at ≤30 min, so do not show a live select. */}
              <div className="control">
                <Clock className="w-4 h-4 hidden sm:block" />
                {contentType === 'trailers' ? (
                  <span
                    className="font-mono text-xs uppercase cursor-default select-none"
                    title="Shorts are limited to 30 minutes or less"
                    aria-label="Runtime is limited to 30 minutes or less in Shorts mode"
                  >
                    ≤30 min
                  </span>
                ) : (
                  <select
                    value={minRuntime}
                    aria-label="Minimum runtime"
                    onChange={(e) => setMinRuntime(Number(e.target.value))}
                  >
                    {RUNTIME_OPTIONS.map(minutes => (
                      <option key={minutes} value={minutes}>
                        {minutes === 0 ? 'Any length' : `${minutes}+ min`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Decade */}
              <div className="control">
                <Calendar className="w-4 h-4 hidden sm:block" />
                <select
                  value={decade ?? ''}
                  aria-label="Decade"
                  onChange={(e) => {
                    track('Filter', { type: 'decade', value: e.target.value || 'any' });
                    setDecade(e.target.value ? Number(e.target.value) : null);
                  }}
                >
                  <option value="">Any decade</option>
                  {[...DECADES].reverse().map(d => (
                    <option key={d} value={d}>{d}s</option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div className="control">
                <SlidersHorizontal className="w-4 h-4 hidden sm:block" />
                <select
                  value={sortBy}
                  aria-label="Sort movies"
                  onChange={(e) => handleSortChange(e.target.value)}
                >
                  {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </SiteHeader>

      <main className="gutter py-6">
        {/* Genre pills */}
        <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-dim" />
              <span className="label">Genre</span>
            </div>
            <div ref={genreRowRef} className={`flex flex-nowrap md:flex-wrap gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:[mask-image:none] ${genreRowAtEnd ? '' : '[mask-image:linear-gradient(to_right,black_94%,transparent)]'}`}>
              <button
                onClick={() => handleGenreChange('all')}
                aria-pressed={genreFilter === 'all'}
                className={genreFilter === 'all' ? 'pill-on' : 'pill'}
              >
                All Genres
              </button>
              {STANDARD_GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => handleGenreChange(genre)}
                  aria-pressed={genreFilter === genre}
                  className={genreFilter === genre ? 'pill-on' : 'pill'}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-muted">
          <span>
            Showing <strong className="text-bone">{movies.length}</strong>
            {' '}{contentType === 'trailers' ? 'shorts' : 'movies'}
            {genreFilter !== 'all' && ` in ${genreFilter}`}
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
          {decade && (
            <>
              <span className="text-line">|</span>
              <span>{decade}s</span>
            </>
          )}
          {sortBy.startsWith('date') && (
            <>
              <span className="text-line">|</span>
              <span>Films with a known release date. Uploads dated the year they were uploaded are left out: that date is usually not the film's.</span>
            </>
          )}
          {tmdbApiKey && (
            <>
              <span className="text-line">|</span>
              <span className="text-nitrate">Posters on</span>
            </>
          )}
        </div>

        {linkError && (
          <div role="alert" className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6 text-red-300">
            {linkError}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-300">Error: {error}</p>
            <button
              onClick={retry}
              className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading state (first batch only - "Load more" keeps the grid visible) */}
        {loading && movies.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-signal" />
            <span className="ml-3 text-lg">Loading movies from Archive.org...</span>
          </div>
        )}

        {/* Movie grid/list */}
        {movies.length > 0 && (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
                : 'space-y-3'
            }
          >
            {movies.map((movie) => (
              <MovieCard
                key={movie.identifier}
                movie={movie}
                viewMode={viewMode}
                onPlay={setSelectedMovie}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && movies.length === 0 && !error && (
          <div className="text-center py-16 text-muted">
            <Film className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No movies found matching your criteria</p>
            <p className="text-sm mt-2">Try adjusting the filters or search query</p>
            {canWiden && widenButton}
          </div>
        )}

        {/* End of the list: say so, or a short list looks like broken paging */}
        {!loading && !nextPage && !error && movies.length > 0 && (
          <div className="text-center mt-8 pt-8 border-t border-line text-muted">
            <p>
              That's all {movies.length}{!activeSearch && ` in ${currentCategory.name}`} for these filters.
            </p>
            {canWiden && widenButton}
          </div>
        )}

        {/* Load more */}
        {nextPage && !error && (movies.length > 0 || !loading) && (
          <div className="flex justify-center mt-8 pt-8 border-t border-line">
            <button
              onClick={handleLoadMore}
              aria-disabled={loading}
              className="btn-primary btn-lg aria-disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Loading...' : 'Load more'}
            </button>
            <span className="sr-only" aria-live="polite">{loadMoreStatus}</span>
          </div>
        )}
      </main>
      <SiteFooter />


      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentApiKey={tmdbApiKey}
      />

      {/* Movie Detail Page */}
      {selectedMovie && (
        <MovieDetailPage
          movie={selectedMovie}
          onClose={() => {
            setSelectedMovie(null);
            // A search made from the film page runs once the page has closed (see afterClose)
            const next = afterClose.current;
            afterClose.current = null;
            next?.();
          }}
          allMovies={movies}
          onPlayRelated={(movie) => setSelectedMovie(movie)}
          onSearch={(text) => closeFilmThen(() => handleSearch(text))}
          onPickGenre={(genre) => closeFilmThen(() => { setSearchQuery(''); setActiveSearch(''); handleGenreChange(genre); })}
          onPickCollection={(id) => closeFilmThen(() => handleCategoryChange(id))}
        />
      )}
    </div>
  );
}
