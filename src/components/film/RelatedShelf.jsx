import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import tmdbService from '../../services/tmdb';
import { Sprockets, fieldFor } from '../../ui/FilmCard';
import TitleCover from '../TitleCover';

// "More like this": the shelf under the film, from useRelated. Each card resolves its own
// poster (index first, TMDB after) and opens the film in the same dialog.
function RelatedMovieCard({ movie, onClick }) {
  const [posterUrl, setPosterUrl] = useState(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [tmdbChecked, setTmdbChecked] = useState(false);

  useEffect(() => {
    // Try to get TMDB poster
    tmdbService.searchMovie(movie.title, movie.year, movie.identifier).then(data => {
      if (data?.posterPath) {
        setPosterUrl(tmdbService.getPosterUrl(data.posterPath, 'small'));
      }
    }).finally(() => setTmdbChecked(true));
  }, [movie.title, movie.year, movie.identifier]);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) handleClick(e);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group text-left cursor-pointer focus-visible:outline-none"
      role="button"
      tabIndex={0}
      aria-label={`${movie.title}, ${movie.year}`}
      onKeyDown={handleKeyDown}
    >
      <div className="film-frame group-hover:border-signal group-focus-visible:border-signal mb-2" style={{ background: fieldFor(movie.genres?.[0], movie.identifier), containerType: 'inline-size' }}>
        {posterUrl && !posterFailed ? (
          <img
            src={posterUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setPosterFailed(true)}
          />
        ) : tmdbChecked ? (
          <TitleCover movie={movie} size="small" />
        ) : null}
        <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
          <span className="w-12 h-12 rounded-full bg-signal flex items-center justify-center"><Play className="w-5 h-5 text-ink fill-ink ml-0.5" /></span>
        </div>
        <Sprockets />
      </div>
      <p className="text-sm font-medium text-bone line-clamp-2 leading-snug group-hover:text-signal">
        {movie.title}
      </p>
      {movie.year && (
        <p className="font-mono text-[11px] text-dim">{movie.year}</p>
      )}
    </div>
  );
}

export default function RelatedShelf({ films, genre, onOpen }) {
  if (!films.length) return null;
  return (
    <div className="mt-12">
      <div className="flex items-end justify-between gap-6 mb-6">
        <div>
          <p className="eyebrow">Same shelf</p>
          <h3 className="display text-3xl mt-1.5">More like this</h3>
        </div>
        {genre && <a href={`/browse?genre=${encodeURIComponent(genre)}`} className="nav-link shrink-0 flex items-center gap-2 hover:text-signal">All {genre} <span aria-hidden="true">→</span></a>}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {films.slice(0, 12).map((related) => <RelatedMovieCard key={related.identifier} movie={related} onClick={() => onOpen?.(related)} />)}
      </div>
    </div>
  );
}
