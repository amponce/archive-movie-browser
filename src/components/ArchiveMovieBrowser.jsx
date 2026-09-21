import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
} from 'lucide-react';
import archiveService, { STANDARD_GENRES, VIDEO_CATEGORIES, defaultMinRuntime, runtimeFilter } from '../services/archive';
import tmdbService from '../services/tmdb';
import MovieCard from './MovieCard';
import SearchBox from './SearchBox';
import SettingsModal from './SettingsModal';
import MovieDetailPage from './MovieDetailPage';

export default function ArchiveMovieBrowser() {
  // Settings & UI state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

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

  // TMDB API key from environment variable only
  const tmdbApiKey = tmdbService.apiKey;

  // Data state
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextPage, setNextPage] = useState(null); // next Archive.org page to load, null when exhausted

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('all');
  const [minRuntime, setMinRuntime] = useState(40);
  const [contentType, setContentType] = useState('features'); // 'features' or 'trailers'
  const [sortBy, setSortBy] = useState('downloads');
  const [category, setCategory] = useState('SciFi_Horror'); // Video collection/category

  // Get current category info
  const currentCategory = VIDEO_CATEGORIES.find(c => c.id === category) || VIDEO_CATEGORIES[0];
  const acrossCollections = Boolean(activeSearch) || genreFilter !== 'all';
  const collectionDescription = activeSearch
    ? 'Search results across all collections'
    : genreFilter !== 'all'
      ? `${genreFilter} across all film collections`
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
        seenTitles: seen,
        // The server query already applied the genre, so only runtime is checked here
        filter: runtimeFilter({ shorts: contentType === 'trailers', minRuntime })
      });
      if (requestId !== latestRequest.current) return;

      setMovies(prev => (append ? [...prev, ...result.movies] : result.movies));
      setNextPage(result.nextPage);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(err.message);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [activeSearch, sortBy, genreFilter, category, contentType, minRuntime]);

  // Fetch from the start whenever filters change
  useEffect(() => {
    fetchMovies(1);
  }, [fetchMovies]);

  // Handle search submit
  const handleSearch = (text = searchQuery) => {
    setSearchQuery(text);
    setActiveSearch(text.trim());
    setGenreFilter('all');
  };

  // Handle genre filter change
  const handleGenreChange = (genre) => {
    setGenreFilter(genre);
  };

  // Handle sort change
  const handleSortChange = (newSort) => {
    setSortBy(newSort);
  };

  // Handle category change
  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    // Cartoons, Prelinger films and most uploads are short or have no runtime, so only
    // feature-film collections start on the 40+ minute filter
    setContentType('features');
    setMinRuntime(defaultMinRuntime(newCategory));
    // Searches span all collections, so picking one means going back to browsing it
    setSearchQuery('');
    setActiveSearch('');
    setGenreFilter('all'); // Reset genre filter when changing category
  };

  // Track TMDB ratings for client-side sorting
  const [tmdbRatings, setTmdbRatings] = useState({});

  // Stable callback for MovieCard
  const handleTmdbData = useCallback((id, data) => {
    if (data?.voteAverage) {
      setTmdbRatings(prev => ({ ...prev, [id]: data.voteAverage }));
    }
  }, []);

  // Runtime and genre filtering already happened in fetchMovies; films with no
  // TMDB poster stay in the list and get a title cover
  const displayedMovies = useMemo(() => {
    // Client-side sort by TMDB rating
    if (sortBy === 'tmdb_rating') {
      return [...movies].sort((a, b) => (tmdbRatings[b.identifier] || 0) - (tmdbRatings[a.identifier] || 0));
    }
    return movies;
  }, [movies, sortBy, tmdbRatings]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
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
                  onClick={() => setViewMode('grid')}
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
                  onClick={() => setViewMode('list')}
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

            {/* Filters row */}
            <div className="flex flex-wrap gap-2">
              {/* Category/Collection dropdown */}
              <div className="flex items-center gap-1 sm:gap-2 bg-gray-800 rounded-lg px-2 sm:px-3">
                <Library className="w-4 h-4 text-yellow-400 hidden sm:block" />
                <select
                  value={category}
                  aria-label="Collection"
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="bg-gray-800 text-white py-2 text-xs sm:text-sm focus:outline-none cursor-pointer max-w-[140px] sm:max-w-none"
                >
                  {VIDEO_CATEGORIES.map((cat) => (
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

              {/* Sort */}
              <div className="flex items-center gap-1 sm:gap-2 bg-gray-800 rounded-lg px-2 sm:px-3">
                <SlidersHorizontal className="w-4 h-4 text-gray-400 hidden sm:block" />
                <select
                  value={sortBy}
                  aria-label="Sort movies"
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="bg-gray-800 text-white py-2 text-xs sm:text-sm focus:outline-none cursor-pointer"
                >
                  <option value="downloads">Most Popular</option>
                  <option value="avg_rating">Top Rated (Archive)</option>
                  <option value="tmdb_rating">Top Rated (TMDB)</option>
                  <option value="date desc">Release Date (Newest)</option>
                  <option value="date asc">Release Date (Oldest)</option>
                  <option value="publicdate desc">Recently Added</option>
                  <option value="publicdate asc">Oldest Added</option>
                  <option value="title asc">Title A-Z</option>
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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleGenreChange('all')}
                aria-pressed={genreFilter === 'all'}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
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
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
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
            {genreFilter !== 'all' && ` in ${genreFilter}${activeSearch ? '' : ' across all film collections'}`}
            {activeSearch && ` for "${activeSearch}" across all collections`}
          </span>
          {contentType !== 'trailers' && minRuntime > 0 && (
            <>
              <span className="text-gray-600">|</span>
              <span>{minRuntime}+ min runtime</span>
            </>
          )}
          {tmdbApiKey && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-green-400">TMDB enabled</span>
            </>
          )}
        </div>

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
                onTmdbData={handleTmdbData}
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
          </div>
        )}

        {/* Load more */}
        {nextPage && !error && (displayedMovies.length > 0 || !loading) && (
          <div className="flex justify-center mt-8 pt-8 border-t border-gray-800">
            <button
              onClick={() => fetchMovies(nextPage)}
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
              href={`https://archive.org/details/${acrossCollections ? 'movies' : category}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:underline"
            >
              Internet Archive's {acrossCollections ? 'Moving Image Archive' : `${currentCategory.name} Collection`}
            </a>
          </p>
          {tmdbApiKey && (
            <p className="mt-1">
              Movie posters powered by{' '}
              <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-400 hover:underline"
              >
                TMDB
              </a>
            </p>
          )}
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
          onClose={() => setSelectedMovie(null)}
          allMovies={displayedMovies}
          onPlayRelated={(movie) => setSelectedMovie(movie)}
        />
      )}
    </div>
  );
}
