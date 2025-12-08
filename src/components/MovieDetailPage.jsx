import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ExternalLink,
  Clock,
  Star,
  Play,
  Calendar,
  Users,
  Film,
  Globe,
  DollarSign,
  TrendingUp,
  ChevronLeft
} from 'lucide-react';
import tmdbService from '../services/tmdb';
import archiveService from '../services/archive';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

// Sub-component for related movies with TMDB poster support
function RelatedMovieCard({ movie, onClick }) {
  const [posterUrl, setPosterUrl] = useState(movie.thumbnailUrl);

  useEffect(() => {
    // Try to get TMDB poster
    tmdbService.searchMovie(movie.title, movie.year).then(data => {
      if (data?.posterPath) {
        setPosterUrl(tmdbService.getPosterUrl(data.posterPath, 'small'));
      }
    });
  }, [movie.title, movie.year]);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group text-left cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick(e)}
    >
      <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden mb-2">
        <img
          src={posterUrl}
          alt={movie.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = movie.thumbnailUrl;
          }}
        />
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
          <Play className="w-10 h-10 text-yellow-400 fill-yellow-400" />
        </div>
      </div>
      <p className="text-sm text-gray-400 truncate group-hover:text-yellow-400">
        {movie.title}
      </p>
      {movie.year && (
        <p className="text-xs text-gray-600">{movie.year}</p>
      )}
    </div>
  );
}

export default function MovieDetailPage({ movie, onClose, allMovies = [], onPlayRelated }) {
  const [tmdbData, setTmdbData] = useState(null);
  const [tmdbDetails, setTmdbDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = React.useRef(null);

  // Scroll to player when it opens
  useEffect(() => {
    if (isPlaying && playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isPlaying]);

  // Fetch TMDB data
  useEffect(() => {
    if (!movie) return;

    setLoading(true);
    setIsPlaying(false);

    // Search for movie on TMDB
    tmdbService.searchMovie(movie.title, movie.year).then(async (data) => {
      setTmdbData(data);

      // If we found a match, fetch detailed info
      if (data?.id) {
        try {
          const detailsRes = await fetch(
            `https://api.themoviedb.org/3/movie/${data.id}?api_key=${TMDB_API_KEY}&append_to_response=credits,similar,recommendations`
          );
          if (detailsRes.ok) {
            const details = await detailsRes.json();
            setTmdbDetails(details);
          }
        } catch (err) {
          console.error('Failed to fetch TMDB details:', err);
        }
      }
      setLoading(false);
    });
  }, [movie]);

  // Find related movies from our collection based on genre
  const relatedMovies = useMemo(() => {
    if (!allMovies.length || !movie?.genres) return [];

    return allMovies
      .filter(m =>
        m.identifier !== movie.identifier &&
        m.genres?.some(g => movie.genres.includes(g))
      )
      .slice(0, 12);
  }, [allMovies, movie]);

  if (!movie) return null;

  const embedUrl = `https://archive.org/embed/${movie.identifier}`;
  const posterUrl = tmdbData?.posterPath
    ? tmdbService.getPosterUrl(tmdbData.posterPath, 'large')
    : movie.thumbnailUrl;
  const backdropUrl = tmdbDetails?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${tmdbDetails.backdrop_path}`
    : null;

  const director = tmdbDetails?.credits?.crew?.find(c => c.job === 'Director');
  const cast = tmdbDetails?.credits?.cast?.slice(0, 6) || [];
  const genres = tmdbDetails?.genres || movie.genres?.map(g => ({ name: g })) || [];

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 overflow-y-auto">
      {/* Backdrop image */}
      {backdropUrl && (
        <div
          className="absolute inset-0 h-96 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 via-gray-900/80 to-gray-900" />
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/90 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Back to Browse</span>
          </button>

          <a
            href={movie.archiveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-yellow-400"
          >
            View on Archive.org
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-8">
        {/* Main content */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 w-full lg:w-80">
            <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden shadow-2xl">
              {posterUrl && (
                <img
                  src={posterUrl}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Play button overlay */}
              {!isPlaying && (
                <button
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 hover:bg-black/40 transition-colors group"
                >
                  <div className="w-20 h-20 rounded-full bg-yellow-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-10 h-10 text-gray-900 fill-gray-900 ml-1" />
                  </div>
                </button>
              )}
            </div>

            {/* Quick stats */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {tmdbDetails?.vote_average > 0 && (
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-yellow-400">
                    <Star className="w-5 h-5 fill-current" />
                    <span className="text-xl font-bold">{tmdbDetails.vote_average.toFixed(1)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">TMDB Rating</p>
                </div>
              )}
              {(movie.runtimeMinutes > 0 || tmdbDetails?.runtime > 0) && (
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-white">
                    <Clock className="w-5 h-5" />
                    <span className="text-xl font-bold">
                      {tmdbDetails?.runtime || movie.runtimeMinutes}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Minutes</p>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
              {tmdbDetails?.title || movie.title}
            </h1>

            {/* Tagline */}
            {tmdbDetails?.tagline && (
              <p className="text-lg text-gray-400 italic mb-4">"{tmdbDetails.tagline}"</p>
            )}

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-6">
              {(tmdbDetails?.release_date || movie.year) && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {tmdbDetails?.release_date?.split('-')[0] || movie.year}
                </span>
              )}
              {tmdbDetails?.original_language && (
                <span className="flex items-center gap-1">
                  <Globe className="w-4 h-4" />
                  {tmdbDetails.original_language.toUpperCase()}
                </span>
              )}
              {tmdbDetails?.budget > 0 && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  ${(tmdbDetails.budget / 1000000).toFixed(1)}M budget
                </span>
              )}
              {movie.downloads > 0 && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {Number(movie.downloads).toLocaleString()} downloads
                </span>
              )}
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {genres.map((genre, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm"
                  >
                    {genre.name || genre}
                  </span>
                ))}
              </div>
            )}

            {/* Overview */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">Overview</h3>
              <p className="text-gray-400 leading-relaxed">
                {tmdbDetails?.overview || movie.description || 'No description available.'}
              </p>
            </div>

            {/* Director */}
            {director && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Director</h3>
                <p className="text-gray-400">{director.name}</p>
              </div>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Cast</h3>
                <div className="flex flex-wrap gap-3">
                  {cast.map((actor) => (
                    <div key={actor.id} className="flex items-center gap-2 bg-gray-800 rounded-full pr-3">
                      {actor.profile_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${actor.profile_path}`}
                          alt={actor.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <Users className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                      <div className="text-sm">
                        <p className="text-white">{actor.name}</p>
                        <p className="text-xs text-gray-500">{actor.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Play button */}
            {!isPlaying && (
              <button
                onClick={() => setIsPlaying(true)}
                className="w-full py-4 bg-yellow-500 text-gray-900 font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors mb-6 text-lg"
              >
                <Play className="w-6 h-6 fill-current" />
                Watch Now
              </button>
            )}
          </div>
        </div>

        {/* Video Player */}
        {isPlaying && (
          <div className="mt-8" ref={playerRef}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Now Playing</h3>
              <button
                onClick={() => setIsPlaying(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                Close Player
              </button>
            </div>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                allowFullScreen
                allow="autoplay; fullscreen"
                title={movie.title}
              />
            </div>
          </div>
        )}

        {/* Related from our collection */}
        {relatedMovies.length > 0 && (
          <div className="mt-12">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Play className="w-5 h-5" />
              Watch More on Archive.org
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {relatedMovies.slice(0, 6).map((related) => (
                <RelatedMovieCard
                  key={related.identifier}
                  movie={related}
                  onClick={() => onPlayRelated?.(related)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
