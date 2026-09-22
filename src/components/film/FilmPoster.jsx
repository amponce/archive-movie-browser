import React from 'react';
import { Play, Star, Clock } from 'lucide-react';
import { Sprockets, fieldFor } from '../../ui/FilmCard';
import TitleCover from '../TitleCover';

// The poster with the play button over it, and under it the two numbers that matter: the
// rating, and how long this upload runs (flagged when it is a trailer or a clip).
export default function FilmPoster({ movie, details, playing, onPlay }) {
  const { posterUrl, loading, tmdbDetails, uploadMinutes, filmMinutes, isExcerpt } = details;
  return (
    <div className={`flex-shrink-0 mx-auto lg:mx-0 ${playing ? 'hidden lg:block lg:w-[200px]' : 'w-full max-w-sm lg:w-[360px]'}`}>
      <div className="film-frame shadow-2xl" style={{ background: fieldFor(movie.genres?.[0], movie.identifier), containerType: 'inline-size' }}>
        {posterUrl ? <img src={posterUrl} alt={movie.title} className="absolute inset-0 w-full h-full object-cover" />
          : !loading ? <TitleCover movie={movie} /> : null}
        <Sprockets />
        {!playing && (
          <button onClick={onPlay} aria-label={`Play ${movie.title}`} className="absolute inset-0 flex items-center justify-center bg-transparent hover:bg-ink/40 focus-visible:bg-ink/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-signal transition-colors group">
            <div className="w-[88px] h-[88px] rounded-full bg-signal flex items-center justify-center group-hover:scale-105 transition-transform">
              <Play className="w-9 h-9 text-ink fill-ink ml-1" />
            </div>
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {tmdbDetails?.vote_average > 0 && (
          <div className="panel p-3">
            <p className="label">TMDB rating</p>
            <p className="font-display font-extrabold text-2xl mt-1 tabular-nums flex items-center gap-1.5"><Star className="w-4 h-4 fill-signal text-signal" />{tmdbDetails.vote_average.toFixed(1)}</p>
          </div>
        )}
        {(uploadMinutes || filmMinutes) && (
          <div className={`panel p-3 ${isExcerpt ? 'border-signal' : ''}`}>
            <p className="label">{isExcerpt ? 'This upload' : 'Runtime'}</p>
            <p className="font-display font-extrabold text-2xl mt-1 tabular-nums flex items-center gap-1.5"><Clock className="w-4 h-4 text-dim" />{Math.round(uploadMinutes || filmMinutes)} min</p>
            {isExcerpt && <p className="text-xs text-muted mt-1">A trailer or a clip. The film runs {filmMinutes} min.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
