import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  Film,
  Clock,
  Filter,
  RefreshCw,
  Loader2,
  Settings,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';
import archiveService, { STANDARD_GENRES } from '../services/archive';
import tmdbService, { hasCachedPoster } from '../services/tmdb';
import MovieCard from './MovieCard';
import SettingsModal from './SettingsModal';
import MovieDetailPage from './MovieDetailPage';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

export default function ArchiveMovieBrowser() {
  // Settings & UI state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

  // TMDB API key from environment variable only
  const tmdbApiKey = TMDB_API_KEY;

  // Data state
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalResults, setTotalResults] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('all');
  const [minRuntime, setMinRuntime] = useState(40);
  const [contentType, setContentType] = useState('features'); // 'features' or 'trailers'
  const [sortBy, setSortBy] = useState('downloads');
  const [page, setPage] = useState(1);
  const [rowsPerPage] = useState(500);

  // Initialize TMDB service
  useEffect(() => {
    if (tmdbApiKey) {
      tmdbService.setApiKey(tmdbApiKey);
    }
  }, [tmdbApiKey]);


  // Fetch movies
  const fetchMovies = useCallback(async (pageNum, shouldAppend = false) => {
    setLoading(true);
    setError(null);

    try {
      // tmdb_rating is client-side only, use downloads for API sorting
      const apiSortBy = sortBy === 'tmdb_rating' ? 'downloads' : sortBy;

      const result = await archiveService.fetchMovies({
        searchQuery: activeSearch,
        sortBy: apiSortBy,
        page: pageNum,
        rowsPerPage,
        genre: genreFilter !== 'all' ? genreFilter : null
      });

      if (shouldAppend && pageNum > 1) {
        // Append new results to existing movies
        setMovies(prev => {
          const existingIds = new Set(prev.map(m => m.identifier));
          const newMovies = result.movies.filter(m => !existingIds.has(m.identifier));
          return [...prev, ...newMovies];
        });
      } else {
        setMovies(result.movies);
      }
      setTotalResults(result.total);
    } catch (err) {
      setError(err.message);
      if (!shouldAppend) setMovies([]);
    } finally {
      setLoading(false);
    }
  }, [activeSearch, sortBy, rowsPerPage, genreFilter]);

  // Fetch when page 1 is needed (initial load or filter changes)
  // fetchMovies changes when activeSearch, sortBy, rowsPerPage, or genreFilter change
  useEffect(() => {
    if (page === 1) {
      fetchMovies(1, false);
    }
  }, [fetchMovies, page]);

  // Handle pagination - load more pages
  useEffect(() => {
    if (page > 1) {
      fetchMovies(page, true);
    }
  }, [page, fetchMovies]);

  // Handle search submit
  const handleSearch = () => {
    setActiveSearch(searchQuery);
    setGenreFilter('all');
    setPage(1);
    setMoviesWithoutImages(new Set());
  };

  // Handle genre filter change
  const handleGenreChange = (genre) => {
    setGenreFilter(genre);
    setPage(1);
    setMoviesWithoutImages(new Set());
  };

  // Handle sort change
  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setPage(1);
    setMoviesWithoutImages(new Set());
  };

  // Track movies that failed to load images (no poster available)
  const [moviesWithoutImages, setMoviesWithoutImages] = useState(new Set());
  // Track TMDB ratings for client-side sorting
  const [tmdbRatings, setTmdbRatings] = useState({});

  // Stable callbacks for MovieCard
  const handleImageStatus = useCallback((id, hasImage) => {
    if (!hasImage) {
      setMoviesWithoutImages(prev => new Set([...prev, id]));
    }
  }, []);

  const handleTmdbData = useCallback((id, data) => {
    if (data?.voteAverage) {
      setTmdbRatings(prev => ({ ...prev, [id]: data.voteAverage }));
    }
  }, []);

  // Filter movies by runtime and content type
  const filteredByRuntime = useMemo(() => {
    let filtered;
    if (contentType === 'trailers') {
      // Trailers/shorts: under 30 minutes or no runtime data (likely short content)
      filtered = movies.filter(m => m.runtimeMinutes === 0 || m.runtimeMinutes <= 30);
    } else {
      // Full movies: filter by minimum runtime (must have runtime data)
      filtered = movies.filter(m => m.runtimeMinutes >= minRuntime);
    }

    // If no active search, filter out movies known to not have TMDB posters
    if (!activeSearch && tmdbApiKey) {
      filtered = filtered.filter(m => {
        // Check if we already know this movie has no poster
        if (moviesWithoutImages.has(m.identifier)) return false;
        // Check TMDB cache
        const cachedStatus = hasCachedPoster(m.title, m.year);
        if (cachedStatus === false) return false;
        // Unknown or has poster - show it
        return true;
      });
    }

    return filtered;
  }, [movies, minRuntime, contentType, activeSearch, moviesWithoutImages, tmdbApiKey]);

  // Get genres from filtered movies
  const availableGenres = useMemo(() => {
    const genreCounts = {};
    filteredByRuntime.forEach(movie => {
      movie.genres.forEach(genre => {
        if (genre !== 'Uncategorized') {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        }
      });
    });

    // Sort by count, then alphabetically
    return Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([genre, count]) => ({ genre, count }));
  }, [filteredByRuntime]);

  // Filter by genre and apply client-side sorting for TMDB rating
  const displayedMovies = useMemo(() => {
    let filtered = genreFilter === 'all'
      ? filteredByRuntime
      : filteredByRuntime.filter(m => m.genres.includes(genreFilter));

    // Client-side sort by TMDB rating
    if (sortBy === 'tmdb_rating') {
      filtered = [...filtered].sort((a, b) => {
        const ratingA = tmdbRatings[a.identifier] || 0;
        const ratingB = tmdbRatings[b.identifier] || 0;
        return ratingB - ratingA;
      });
    }

    return filtered;
  }, [filteredByRuntime, genreFilter, sortBy, tmdbRatings]);

  // Pagination
  const totalPages = Math.ceil(totalResults / rowsPerPage);


  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Film className="w-8 h-8 text-yellow-400" />
              <div>
                <h1 className="text-xl font-bold">Archive.org Movies</h1>
                <p className="text-xs text-gray-500">
                  Browse full-length films from the Internet Archive
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
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="space-y-3">
            {/* Search row */}
            <div className="flex gap-2">
              <div className="flex-1 relative flex">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search movies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-l-lg focus:outline-none focus:border-yellow-400 min-w-0"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-3 sm:px-4 py-2 bg-yellow-500 text-gray-900 font-medium rounded-r-lg hover:bg-yellow-400 disabled:opacity-50 flex items-center gap-1 sm:gap-2 flex-shrink-0"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Search</span>
                </button>
              </div>
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap gap-2">
              {/* Content type toggle */}
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => {
                    setContentType('features');
                    setMinRuntime(40);
                  }}
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
                  className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium transition-colors ${
                    contentType === 'trailers'
                      ? 'bg-yellow-500 text-gray-900'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Shorts
                </button>
              </div>

              {/* Runtime filter */}
              <div className="flex items-center gap-1 sm:gap-2 bg-gray-800 rounded-lg px-2 sm:px-3">
                <Clock className="w-4 h-4 text-gray-400 hidden sm:block" />
                <select
                  value={minRuntime}
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
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1 sm:gap-2 bg-gray-800 rounded-lg px-2 sm:px-3">
                <SlidersHorizontal className="w-4 h-4 text-gray-400 hidden sm:block" />
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="bg-gray-800 text-white py-2 text-xs sm:text-sm focus:outline-none cursor-pointer"
                >
                  <option value="downloads">Popular</option>
                  <option value="avg_rating">Archive Rating</option>
                  <option value="tmdb_rating">Rating (IMDB/TMDB)</option>
                  <option value="date">Newest</option>
                  <option value="publicdate">Recently Added</option>
                  <option value="title">A-Z</option>
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
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  genreFilter === 'all'
                    ? 'bg-yellow-500 text-gray-900'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                All Genres
              </button>
              {STANDARD_GENRES.slice(0, 12).map((genre) => (
                <button
                  key={genre}
                  onClick={() => handleGenreChange(genre)}
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
            Showing <strong className="text-white">{displayedMovies.length}</strong> {contentType === 'trailers' ? 'shorts' : 'movies'}
            {genreFilter !== 'all' && ` in ${genreFilter}`}
          </span>
          {contentType !== 'trailers' && (
            <>
              <span className="text-gray-600">|</span>
              <span>{minRuntime}+ min runtime</span>
            </>
          )}
          <span className="text-gray-600">|</span>
          <span>
            Page {page} • <button onClick={() => setPage(p => p + 1)} className="text-yellow-400 hover:underline">Load more</button>
          </span>
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
              onClick={fetchMovies}
              className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
            <span className="ml-3 text-lg">Loading movies from Archive.org...</span>
          </div>
        )}

        {/* Movie grid/list */}
        {!loading && displayedMovies.length > 0 && (
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
                tmdbEnabled={!!tmdbApiKey}
                viewMode={viewMode}
                onPlay={() => setSelectedMovie(movie)}
                onImageStatus={(hasImage) => handleImageStatus(movie.identifier, hasImage)}
                onTmdbData={(data) => handleTmdbData(movie.identifier, data)}
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

        {/* Pagination */}
        {!loading && displayedMovies.length > 0 && (
          <div className="flex items-center justify-center gap-4 mt-8 pt-8 border-t border-gray-800">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 hover:bg-gray-700 disabled:hover:bg-gray-800"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <span className="text-gray-400">Page {page}</span>

            <button
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-gray-900 font-medium rounded-lg hover:bg-yellow-400"
            >
              Load More
              <ChevronRight className="w-4 h-4" />
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
              href="https://archive.org/details/moviesandfilms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:underline"
            >
              Internet Archive's Movies Collection
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
