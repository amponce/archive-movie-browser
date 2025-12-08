import React, { useMemo } from 'react';
import { X, ExternalLink, Clock, Star, Play } from 'lucide-react';
import archiveService from '../services/archive';

export default function VideoPlayerModal({ movie, onClose, allMovies = [], onPlayRelated }) {
  if (!movie) return null;

  const embedUrl = `https://archive.org/embed/${movie.identifier}`;

  // Find related movies based on shared genres
  const relatedMovies = useMemo(() => {
    if (!allMovies.length || !movie.genres) return [];

    return allMovies
      .filter(m =>
        m.identifier !== movie.identifier &&
        m.genres?.some(g => movie.genres.includes(g))
      )
      .slice(0, 8);
  }, [allMovies, movie]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-800">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg sm:text-xl font-semibold text-white truncate">
              {movie.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-400">
              {movie.year && <span>{movie.year}</span>}
              {movie.runtimeMinutes > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {archiveService.formatRuntime(movie.runtimeMinutes)}
                </span>
              )}
              {movie.rating && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Star className="w-3 h-3 fill-current" />
                  {movie.rating.toFixed(1)}
                </span>
              )}
              {movie.genres && movie.genres[0] !== 'Uncategorized' && (
                <span>{movie.genres.slice(0, 3).join(', ')}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={movie.archiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Open on Archive.org"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="relative bg-black aspect-video">
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; fullscreen"
            title={movie.title}
          />
        </div>

        {/* Description */}
        {movie.description && (
          <div className="p-4 border-t border-gray-800 max-h-24 overflow-y-auto">
            <p className="text-sm text-gray-400">
              {typeof movie.description === 'string'
                ? movie.description
                : String(movie.description)}
            </p>
          </div>
        )}

        {/* Related Movies */}
        {relatedMovies.length > 0 && (
          <div className="p-4 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Related Movies</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {relatedMovies.map(related => (
                <button
                  key={related.identifier}
                  onClick={() => onPlayRelated?.(related)}
                  className="flex-shrink-0 w-24 group"
                >
                  <div className="relative aspect-[2/3] bg-gray-700 rounded overflow-hidden mb-1">
                    <img
                      src={related.thumbnailUrl}
                      alt={related.title}
                      className="w-full h-full object-cover"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 truncate group-hover:text-yellow-400">
                    {related.title}
                  </p>
                  {related.year && (
                    <p className="text-xs text-gray-600">{related.year}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
