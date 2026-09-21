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
import archiveService, { STANDARD_GENRES, VIDEO_CATEGORIES, BROWSABLE_COLLECTIONS, DECADES, ALL_FILMS, defaultMinRuntime, runtimeFilter, collectionChoice } from '../services/archive';
import tmdbService from '../services/tmdb';
import { postersFirst } from '../services/posterIndex';
import { parseArchiveUrl } from '../services/archiveUrl';
import { parseFilters, filtersToQuery, SORT_OPTIONS } from '../services/urlFilters';
import { track } from '../services/analytics';
import MovieCard from './MovieCard';
import SearchBox from './SearchBox';
import SettingsModal from './SettingsModal';
import MovieDetailPage from './MovieDetailPage';
import McpBanner from './McpBanner';

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

  // Allow a shared #identifier URL to open an Archive.org item directly.
  useEffect(() => {
    const identifier = window.location.hash.slice(1);
    if (!identifier) return;

    let cancelled = false;
    let decodedIdentifier;
    try {
      decodedIdentifier = decodeURIComponent(identifier);
    } catch {
      decodedIdentifier = identifier;
    }

    archiveService.getMovieByIdentifier(decodedIdentifier)
      .then((movie) => {
        if (!cancelled) setSelectedMovie(movie);
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to open movie from URL hash:', err);
      });

    return () => { cancelled = true; };
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
  const openFilmLink = (identifier) => {
    setLinkError(null);
    archiveService.getMovieByIdentifier(identifier)
      .then(setSelectedMovie)
      .catch(() => setLinkError(`Couldn't open that Archive.org link. Check the address: nothing was found at "${identifier}".`));
  };

  // TMDB API key from environment variable only
  const tmdbApiKey = tmdbService.apiKey;

  // Data state
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextPage, setNextPage] = useState(null); // next Archive.org page to load, null when exhausted

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

  // Only the latest request may update state (older responses can arrive last)
  const latestRequest = useRef(0);

  // Titles already shown, so the same film isn't repeated across batches
  const seenTitles = useRef(new Set());

  // Fetch a batch of movies. startPage 1 replaces the list, later pages append.
  const fetchMovies = useCallback(async (startPage = 1) => {
    const requestId = ++latestRequest.current;
    const append = startPage > 1;
    if (!append) {
      seenTitles.current = new Set();
      setMovies([]);
    }
    const seen = seenTitles.current;
    setLoading(true);
    setError(null);

    try {
      // Parse sort value (may include direction like "date desc" or "date asc")
      let apiSortBy = sortBy;
      let sortOrder = 'desc';

      // tmdb_rating is client-side only, use downloads for API sorting
      if (sortBy === 'tmdb_rating') {
        apiSortBy = 'downloads';
      } else if (sortBy.includes(' ')) {
        // Parse "field direction" format
        const [field, direction] = sortBy.split(' ');
        apiSortBy = field;
        sortOrder = direction;
      }

      // Filters run inside the service so every batch comes back full
      const result = await archiveService.fetchFiltered({
        searchQuery: activeSearch,
        sortBy: apiSortBy,
        sortOrder,
        startPage,
        genre: genreFilter !== 'all' ? genreFilter : null,
        collection: category,
        decade,
        seenTitles: seen,
        // The server query already applied the genre, so only runtime is checked here
        filter: runtimeFilter({ shorts: contentType === 'trailers', minRuntime })
      });
      if (requestId !== latestRequest.current) return;

      // Ratings arrive one film at a time. Ranking the batch before it is shown means no card
      // ever moves once it is on screen, and "Load more" adds its films below the ones already there.
      // Most Popular leads with films that have a real poster; sorts with a visible order
      // (title, date, rating) are left exactly as Archive.org returned them.
      const batch = sortBy === 'tmdb_rating' ? await tmdbService.sortByRating(result.movies)
        : sortBy === 'downloads' ? await postersFirst(result.movies)
        : result.movies;
      if (requestId !== latestRequest.current) return;

      setMovies(prev => (append ? [...prev, ...batch] : batch));
      setNextPage(result.nextPage);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(err.message);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [activeSearch, sortBy, genreFilter, category, contentType, minRuntime, decade]);

  // Fetch from the start whenever filters change
  useEffect(() => {
    fetchMovies(1);
  }, [fetchMovies]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, genreFilter, activeSearch, decade]);

  useEffect(() => {
    writeFiltersToUrl('replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, minRuntime, contentType]);

  // Back/Forward between filter views: restore the state from the URL.
  useEffect(() => {
    const onPopState = () => {
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

  // Runtime, genre and rating order were all settled in fetchMovies; films with no
  // TMDB poster stay in the list and get a title cover
  const displayedMovies = movies;

  // A single collection can be small (Sci-Fi & Horror has 51 films from the 1980s; all the
  // film collections together have 5,300), so offer the wider look with the same filters.
  const canWiden = !activeSearch && category !== ALL_FILMS;
  const widenButton = (
    <button
      onClick={() => { track('Filter', { type: 'collection', value: 'all (widened)' }); setCategory(ALL_FILMS); }}
      className="mt-3 px-4 py-2 rounded-lg bg-gray-800 text-yellow-400 hover:bg-gray-700 text-sm font-medium"
    >
      Look in All Films instead
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <McpBanner />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Film className="w-8 h-8 text-yellow-400" />
              <div>
                <h1 className="text-xl font-bold">Archive.org Videos</h1>
                <p className="text-xs text-gray-500">
                  {collectionDescription}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => changeViewMode('grid')}
                  className={`p-2 rounded ${
                    viewMode === 'grid'
                      ? 'bg-gray-700 text-yellow-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Grid view"
                  aria-label="Grid view"
                  aria-pressed={viewMode === 'grid'}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => changeViewMode('list')}
                  className={`p-2 rounded ${
                    viewMode === 'list'
                      ? 'bg-gray-700 text-yellow-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
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
                className={`p-2 rounded-lg transition-colors ${
                  tmdbApiKey
                    ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
                title={tmdbApiKey ? 'TMDB enabled - Click to configure' : 'Configure TMDB API'}
                aria-label="Configure TMDB API"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="space-y-3">
            {/* Search row */}
            <div className="flex gap-2">
              <SearchBox
                value={searchQuery}
                onChange={(text) => {
                  setSearchQuery(text);
                  // Emptying the box ends the search
                  if (text === '') setActiveSearch('');
                }}
                onSearch={handleSearch}
                onOpenFilm={setSelectedMovie}
                onPickGenre={(genre) => {
                  setSearchQuery('');
                  setActiveSearch('');
                  handleGenreChange(genre);
                }}
                onPickCollection={handleCategoryChange}
                movies={movies}
                loading={loading}
              />
            </div>

            {/* Mobile disclosure keeps active choices visible without a tall sticky header. */}
            <button
              className="md:hidden flex items-center gap-2 w-full text-left text-xs text-gray-300"
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
              <div className="flex items-center gap-1 sm:gap-2 bg-gray-800 rounded-lg px-2 sm:px-3">
                <Library className="w-4 h-4 text-yellow-400 hidden sm:block" />
                <select
                  value={activeSearch ? 'search' : category}
                  aria-label="Collection"
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="bg-gray-800 text-white py-2 text-xs sm:text-sm focus:outline-none cursor-pointer max-w-[140px] sm:max-w-none"
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
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => {
                    setContentType('features');
                    setMinRuntime(defaultMinRuntime(category));
                  }}
                  aria-pressed={contentType === 'features'}
                  className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors ${
                    contentType === 'features'
                      ? 'bg-yellow-500 text-gray-900'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Full Movies
                </button>
                <button
                  onClick={() => {
                    setContentType('trailers');
                    setMinRuntime(0);
                  }}
                  aria-pressed={contentType === 'trailers'}
                  className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors ${
                    contentType === 'trailers'
                      ? 'bg-yellow-500 text-gray-900'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Shorts
                </button>
              </div>

              {/* Runtime filter. Shorts are hard-capped at ≤30 min, so do not show a live select. */}
              <div className="flex items-center gap-1 sm:gap-2 bg-gray-800 rounded-lg px-2 sm:px-3">
                <Clock className="w-4 h-4 text-gray-400 hidden sm:block" />
                {contentType === 'trailers' ? (
                  <span
                    className="py-2 text-xs sm:text-sm text-gray-400 cursor-default select-none"
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
                    className="bg-gray-800 text-white py-2 text-xs sm:text-sm focus:outline-none cursor-pointer"
                  >
                    <option value={0}>Any length</option>
                    <option value={20}>20+ min</option>
                    <option value={40}>40+ min</option>
                    <option value={60}>60+ min</option>
                    <option value={75}>75+ min</option>
                    <option value={90}>90+ min</option>
                  </select>
                )}
              </div>

              {/* Decade */}
              <div className="flex items-center gap-1 sm:gap-2 bg-gray-800 rounded-lg px-2 sm:px-3">
                <Calendar className="w-4 h-4 text-gray-400 hidden sm:block" />
                <select
                  value={decade ?? ''}
                  aria-label="Decade"
                  onChange={(e) => {
                    track('Filter', { type: 'decade', value: e.target.value || 'any' });
                    setDecade(e.target.value ? Number(e.target.value) : null);
                  }}
                  className="bg-gray-800 text-white py-2 text-xs sm:text-sm focus:outline-none cursor-pointer"
                >
                  <option value="">Any decade</option>
                  {[...DECADES].reverse().map(d => (
                    <option key={d} value={d}>{d}s</option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1 sm:gap-2 bg-gray-800 rounded-lg px-2 sm:px-3">
                <SlidersHorizontal className="w-4 h-4 text-gray-400 hidden sm:block" />
                <select
                  value={sortBy}
                  aria-label="Sort movies"
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="bg-gray-800 text-white py-2 text-xs sm:text-sm focus:outline-none cursor-pointer"
                >
                  {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Genre pills */}
        <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Filter by genre:</span>
            </div>
            <div ref={genreRowRef} className={`flex flex-nowrap md:flex-wrap gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:[mask-image:none] ${genreRowAtEnd ? '' : '[mask-image:linear-gradient(to_right,black_94%,transparent)]'}`}>
              <button
                onClick={() => handleGenreChange('all')}
                aria-pressed={genreFilter === 'all'}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  genreFilter === 'all'
                    ? 'bg-yellow-500 text-gray-900'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                All Genres
              </button>
              {STANDARD_GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => handleGenreChange(genre)}
                  aria-pressed={genreFilter === genre}
                  className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    genreFilter === genre
                      ? 'bg-yellow-500 text-gray-900'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-gray-400">
          <span>
            Showing <strong className="text-white">{displayedMovies.length}</strong>
            {' '}{contentType === 'trailers' ? 'shorts' : 'movies'}
            {genreFilter !== 'all' && ` in ${genreFilter}`}
            {!activeSearch && ` from ${currentCategory.name}`}
            {activeSearch && ` for "${activeSearch}" across all collections`}
          </span>
          {contentType !== 'trailers' && minRuntime > 0 && (
            <>
              <span className="text-gray-600">|</span>
              <span>{minRuntime}+ min runtime</span>
            </>
          )}
          {decade && (
            <>
              <span className="text-gray-600">|</span>
              <span>{decade}s</span>
            </>
          )}
          {sortBy.startsWith('date') && (
            <>
              <span className="text-gray-600">|</span>
              <span>Films with a known release date. Uploads dated the year they were uploaded are left out: that date is usually not the film's.</span>
            </>
          )}
          {tmdbApiKey && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-green-400">TMDB enabled</span>
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
              onClick={() => fetchMovies(movies.length > 0 && nextPage ? nextPage : 1)}
              className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading state (first batch only - "Load more" keeps the grid visible) */}
        {loading && movies.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
            <span className="ml-3 text-lg">Loading movies from Archive.org...</span>
          </div>
        )}

        {/* Movie grid/list */}
        {displayedMovies.length > 0 && (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
                : 'space-y-3'
            }
          >
            {displayedMovies.map((movie) => (
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
        {!loading && displayedMovies.length === 0 && !error && (
          <div className="text-center py-16 text-gray-400">
            <Film className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No movies found matching your criteria</p>
            <p className="text-sm mt-2">Try adjusting the filters or search query</p>
            {canWiden && widenButton}
          </div>
        )}

        {/* End of the list: say so, or a short list looks like broken paging */}
        {!loading && !nextPage && !error && displayedMovies.length > 0 && (
          <div className="text-center mt-8 pt-8 border-t border-gray-800 text-gray-400">
            <p>
              That's all {displayedMovies.length}{!activeSearch && ` in ${currentCategory.name}`} for these filters.
            </p>
            {canWiden && widenButton}
          </div>
        )}

        {/* Load more */}
        {nextPage && !error && (displayedMovies.length > 0 || !loading) && (
          <div className="flex justify-center mt-8 pt-8 border-t border-gray-800">
            <button
              onClick={() => { track('Load more', { page: nextPage }); fetchMovies(nextPage); }}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-gray-900 font-medium rounded-lg hover:bg-yellow-400 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>
            Data sourced from{' '}
            <a
              href={`https://archive.org/details/${acrossCollections || category === ALL_FILMS ? 'movies' : category}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:underline"
            >
              Internet Archive's {acrossCollections || category === ALL_FILMS ? 'Moving Image Archive' : `${currentCategory.name} Collection`}
            </a>
          </p>
          <p className="mt-1">
            <a href="/mcp" className="text-yellow-400 hover:underline">MCP server</a>: search these films from Claude, Cursor and other MCP clients
          </p>
          <p className="mt-4 max-w-3xl mx-auto text-xs leading-relaxed text-gray-500">
            This is an independent, open-source viewer. It hosts no video: every film is stored and streamed by the{' '}
            <a href="https://archive.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">Internet Archive</a>{' '}
            and appears here as its uploader published it there. We are not affiliated with or endorsed by the Internet Archive.
            For rights questions or to have a film removed, contact the Internet Archive under its{' '}
            <a href="https://archive.org/about/terms.php" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">terms of use and copyright policy</a>;
            once it is gone there, it is gone here. Posters and film details come from{' '}
            <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">TMDB</a>.
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>
      </footer>

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
          allMovies={displayedMovies}
          onPlayRelated={(movie) => setSelectedMovie(movie)}
          onSearch={(text) => closeFilmThen(() => handleSearch(text))}
          onPickGenre={(genre) => closeFilmThen(() => { setSearchQuery(''); setActiveSearch(''); handleGenreChange(genre); })}
          onPickCollection={(id) => closeFilmThen(() => handleCategoryChange(id))}
        />
      )}
    </div>
  );
}
