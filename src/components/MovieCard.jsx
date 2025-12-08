import React, { useState, useEffect, memo } from 'react';
import { Clock, Download, Star, ExternalLink, Play, Image as ImageIcon } from 'lucide-react';
import tmdbService from '../services/tmdb';
import archiveService from '../services/archive';

const MovieCard = memo(function MovieCard({ movie, tmdbEnabled = false, viewMode = 'grid', onPlay, onImageStatus, onTmdbData }) {
  const [tmdbData, setTmdbData] = useState(null);
  const [tmdbChecked, setTmdbChecked] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [statusReported, setStatusReported] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (tmdbEnabled && movie.title && !tmdbChecked) {
      tmdbService.searchMovie(movie.title, movie.year).then(data => {
        if (cancelled) return;
        setTmdbData(data);
        setTmdbChecked(true);
      });
    } else if (!tmdbEnabled && !tmdbChecked) {
      setTmdbChecked(true);
    }

    return () => { cancelled = true; };
  }, [movie.title, movie.year, tmdbEnabled, tmdbChecked]);

  // Report TMDB data once when checked (separate effect to avoid loops)
  useEffect(() => {
    if (!tmdbChecked || statusReported) return;

    if (tmdbData) {
      onTmdbData?.(tmdbData);
      if (tmdbData.posterPath) {
        onImageStatus?.(true);
      } else {
        onImageStatus?.(false);
      }
    } else if (tmdbChecked) {
      onImageStatus?.(false);
    }
    setStatusReported(true);
  }, [tmdbChecked, tmdbData, statusReported]);

  // Determine which poster to use
  const tmdbPosterUrl = tmdbData?.posterPath
    ? tmdbService.getPosterUrl(tmdbData.posterPath, 'medium')
    : null;

  const archiveThumbnailUrl = movie.thumbnailUrl;
  const posterUrl = tmdbPosterUrl || archiveThumbnailUrl;

  const handlePosterError = () => {
    setPosterError(true);
    setPosterLoaded(true);
    // If both TMDB and archive image failed, report no image
    if (tmdbChecked && !tmdbPosterUrl && !statusReported) {
      onImageStatus?.(false);
      setStatusReported(true);
    }
  };

  const handlePosterLoad = () => {
    setPosterLoaded(true);
    // Report successful image load
    if (!statusReported) {
      onImageStatus?.(true);
      setStatusReported(true);
    }
  };

  // Grid view (poster-focused)
  if (viewMode === 'grid') {
    return (
      <div
        onClick={onPlay}
        className="movie-card group block bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-yellow-400 transition-all cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Poster */}
        <div className="relative aspect-[2/3] bg-gray-700 overflow-hidden">
          {!posterLoaded && (
            <div className="absolute inset-0 skeleton flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-gray-600" />
            </div>
          )}

          {posterUrl && !posterError ? (
            <img
              src={posterUrl}
              alt={movie.title}
              className={`movie-poster w-full h-full object-cover transition-transform duration-300 ${
                posterLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={handlePosterLoad}
              onError={handlePosterError}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-700 p-4">
              <ImageIcon className="w-12 h-12 text-gray-500 mb-2" />
              <span className="text-xs text-gray-500 text-center line-clamp-2">
                {movie.title}
              </span>
            </div>
          )}

          {/* Hover overlay */}
          <div
            className={`absolute inset-0 bg-black/70 flex flex-col items-center justify-center transition-opacity ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Play className="w-12 h-12 text-yellow-400 mb-2 fill-yellow-400" />
            <span className="text-sm text-white">Watch Now</span>
          </div>

          {/* TMDB badge */}
          {tmdbData && (
            <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded">
              TMDB
            </div>
          )}

          {/* Rating badge */}
          {(tmdbData?.voteAverage || movie.rating) && (
            <div className="absolute top-2 left-2 bg-black/70 text-yellow-400 text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" />
              {(tmdbData?.voteAverage || movie.rating)?.toFixed(1)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="font-medium text-sm text-white truncate group-hover:text-yellow-400">
            {movie.title}
          </h3>

          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            {movie.year && <span>{movie.year}</span>}
            {movie.runtimeMinutes > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {archiveService.formatRuntime(movie.runtimeMinutes)}
                </span>
              </>
            )}
          </div>

          {movie.genres.length > 0 && movie.genres[0] !== 'Uncategorized' && (
            <div className="flex flex-wrap gap-1 mt-2">
              {movie.genres.slice(0, 2).map(genre => (
                <span
                  key={genre}
                  className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view (detail-focused)
  return (
    <div
      onClick={onPlay}
      className="movie-card flex gap-4 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 group transition-colors cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-28 flex-shrink-0 bg-gray-700 rounded overflow-hidden">
        {!posterLoaded && (
          <div className="absolute inset-0 skeleton" />
        )}

        {posterUrl && !posterError ? (
          <img
            src={posterUrl}
            alt={movie.title}
            className={`w-full h-full object-cover ${posterLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={handlePosterLoad}
            onError={handlePosterError}
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-gray-500" />
          </div>
        )}

        {tmdbData && (
          <div className="absolute top-1 right-1 bg-green-600 text-white text-[10px] px-1 rounded">
            TMDB
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-yellow-400 group-hover:text-yellow-300 truncate">
            {movie.title}
          </h3>
          <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-400">
          {movie.year && <span>{movie.year}</span>}

          {movie.runtimeMinutes > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {archiveService.formatRuntime(movie.runtimeMinutes)}
            </span>
          )}

          {movie.downloads > 0 && (
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {Number(movie.downloads).toLocaleString()}
            </span>
          )}

          {(tmdbData?.voteAverage || movie.rating) && (
            <span className="flex items-center gap-1 text-yellow-400">
              <Star className="w-3 h-3 fill-current" />
              {(tmdbData?.voteAverage || movie.rating)?.toFixed(1)}
            </span>
          )}

          {movie.creator && (
            <span className="truncate max-w-48 text-gray-500">
              {movie.creator}
            </span>
          )}
        </div>

        {movie.genres.length > 0 && movie.genres[0] !== 'Uncategorized' && (
          <div className="flex flex-wrap gap-1 mt-2">
            {movie.genres.slice(0, 4).map(genre => (
              <span
                key={genre}
                className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {movie.description && (
          <p className="text-sm text-gray-500 mt-2 line-clamp-2">
            {typeof movie.description === 'string'
              ? movie.description.slice(0, 200)
              : String(movie.description).slice(0, 200)}
          </p>
        )}
      </div>
    </div>
  );
});

export default MovieCard;
