import React from 'react';
import { Play, Star, Clock } from 'lucide-react';
import { Sprockets, fieldFor } from '../../ui/FilmCard';
import TitleCover from '../TitleCover';

// A pre-filled issue for a poster the index got wrong: the identifier, the upload's title and
// our guess, so the fix is a one-line edit for whoever picks it up (#120)
function wrongPosterIssueUrl(movie, guessedTitle) {
  const body = [
    `Archive.org identifier: ${movie.identifier}`,
    `Upload title: ${movie.title}`,
    `We think this is: ${guessedTitle || 'unknown'}`,
    '',
    'What should it actually be?',
  ].join('\n');
  const params = new URLSearchParams({ title: `Wrong poster: ${movie.identifier}`, body, labels: 'data' });
  return `https://github.com/amponce/archive-movie-browser/issues/new?${params}`;
}

// The poster with the play button over it, and under it the two numbers that matter: the
// rating, and how long this upload runs (flagged when it is a trailer or a clip).
export default function FilmPoster({ movie, details, playing, onPlay }) {
  const { posterUrl, loading, tmdbDetails, tmdbData, uploadMinutes, filmMinutes, isExcerpt, fromIndex } = details;
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
      {fromIndex && (
        <p className="mt-2 text-center">
          <a href={wrongPosterIssueUrl(movie, tmdbDetails?.title || tmdbData?.title)} target="_blank" rel="noopener noreferrer" className="nav-link text-xs">Wrong poster?</a>
        </p>
      )}
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
