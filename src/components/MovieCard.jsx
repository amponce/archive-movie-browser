import React, { useState, useEffect, memo } from 'react';
import { Clock, Download, Star, ExternalLink, Play } from 'lucide-react';
import tmdbService from '../services/tmdb';
import archiveService from '../services/archive';
import { Sprockets, fieldFor } from '../ui/FilmCard';
import TitleCover from './TitleCover';

const MovieCard = memo(function MovieCard({ movie, viewMode = 'grid', onPlay }) {
  const [tmdbData, setTmdbData] = useState(null);
  const [tmdbChecked, setTmdbChecked] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Always ask: the poster index can answer even when there is no TMDB key
    if (movie.title && !tmdbChecked) {
      tmdbService.searchMovie(movie.title, movie.year, movie.identifier).then(data => {
        if (cancelled) return;
        setTmdbData(data);
        setTmdbChecked(true);
      });
    }

    return () => { cancelled = true; };
  }, [movie.title, movie.year, movie.identifier, tmdbChecked]);

  // Determine which poster to use
  const tmdbPosterUrl = tmdbData?.posterPath
    ? tmdbService.getPosterUrl(tmdbData.posterPath, 'medium')
    : null;


  const handlePosterError = () => {
    setPosterError(true);
    setPosterLoaded(true);
  };

  const handlePosterLoad = () => {
    setPosterLoaded(true);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) onPlay?.(movie);
    }
  };

  const genre = movie.genres?.[0] !== 'Uncategorized' ? movie.genres?.[0] : null;
  const rating = tmdbData?.voteAverage || movie.rating;
  const meta = [movie.year, movie.runtimeMinutes > 0 && archiveService.formatRuntime(movie.runtimeMinutes), genre].filter(Boolean).join(' · ');

  // Grid view: the same sprocket frame as the front page
  if (viewMode === 'grid') {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open ${movie.title}`}
        onKeyDown={handleKeyDown}
        onClick={() => onPlay?.(movie)}
        className="movie-card group block min-w-0 cursor-pointer focus-visible:outline-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="film-frame group-hover:border-signal group-focus-visible:border-signal" style={{ background: fieldFor(genre, movie.identifier), containerType: 'inline-size' }}>
          {!tmdbChecked || (tmdbPosterUrl && !posterLoaded) ? <span className="absolute inset-0 skeleton" /> : null}

          {tmdbPosterUrl && !posterError ? (
            <img
              src={tmdbPosterUrl}
              alt=""
              className={`movie-poster absolute inset-0 w-full h-full object-cover ${posterLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={handlePosterLoad}
              onError={handlePosterError}
              loading="lazy"
            />
          ) : tmdbChecked ? (
            // No poster anywhere: the card is the poster
            <TitleCover movie={movie} />
          ) : null}

          {/* Hover: one play mark */}
          <span className={`absolute inset-0 flex items-center justify-center bg-ink/50 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <span className="w-14 h-14 rounded-full bg-signal flex items-center justify-center"><Play className="w-6 h-6 fill-ink text-ink ml-0.5" /></span>
          </span>

          {rating ? (
            <span className="absolute top-3 right-4 font-mono text-[10px] tracking-[0.1em] bg-bone text-ink px-1.5 py-0.5 rounded-sm tabular-nums">{rating.toFixed(1)}</span>
          ) : null}
          <Sprockets />
        </span>

        <h3 className="mt-3 font-sans font-medium text-sm text-bone leading-snug line-clamp-2 group-hover:text-signal">{movie.title}</h3>
        {meta && <span className="block mt-0.5 font-mono text-[11px] text-dim tabular-nums">{meta}</span>}
      </div>
    );
  }

  // List view (detail-focused)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${movie.title}`}
      onKeyDown={handleKeyDown}
      onClick={() => onPlay?.(movie)}
      className="movie-card flex gap-4 p-3 panel hover:border-bone group transition-colors cursor-pointer focus-visible:outline-none focus-visible:border-signal"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-28 flex-shrink-0 rounded overflow-hidden" style={{ background: fieldFor(genre, movie.identifier) }}>
        {(!tmdbChecked || (tmdbPosterUrl && !posterLoaded)) && (
          <div className="absolute inset-0 skeleton" />
        )}

        {tmdbPosterUrl && !posterError ? (
          <img
            src={tmdbPosterUrl}
            alt={movie.title}
            className={`w-full h-full object-cover ${posterLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={handlePosterLoad}
            onError={handlePosterError}
            loading="lazy"
          />
        ) : null}
        <Sprockets />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-bone group-hover:text-signal truncate">
            {movie.title}
          </h3>
          <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-dim" />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-1 font-mono text-xs text-dim">
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
            <span className="flex items-center gap-1 text-signal">
              <Star className="w-3 h-3 fill-current" />
              {(tmdbData?.voteAverage || movie.rating)?.toFixed(1)}
            </span>
          )}

          {movie.creator && (
            <span className="truncate max-w-48 text-dim">
              {movie.creator}
            </span>
          )}
        </div>

        {movie.genres.length > 0 && movie.genres[0] !== 'Uncategorized' && (
          <div className="flex flex-wrap gap-1 mt-2">
            {movie.genres.slice(0, 4).map(genre => (
              <span
                key={genre}
                className="pill h-6 px-2.5 text-[10px]"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {movie.description && (
          <p className="text-sm text-muted mt-2 line-clamp-2">
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
