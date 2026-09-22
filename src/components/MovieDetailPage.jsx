import React, { useState, useEffect, useRef, useId } from 'react';
import useFilmDetails from '../hooks/useFilmDetails';
import useFilmDialog from '../hooks/useFilmDialog';
import useRelated from '../hooks/useRelated';
import FilmTopBar from './film/FilmTopBar';
import FilmPoster from './film/FilmPoster';
import FilmDetails from './film/FilmDetails';
import NowPlaying from './film/NowPlaying';
import RelatedShelf from './film/RelatedShelf';

// The film page: a full-screen <dialog> over the browser. What the page knows comes from
// useFilmDetails, how the dialog behaves from useFilmDialog, and the pieces are in
// components/film. Escape, Back and the close button all go through history.
export default function MovieDetailPage({ movie, onClose, allMovies = [], onPlayRelated, onSearch, onPickGenre, onPickCollection }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const dialogRef = useRef(null);
  const backButtonRef = useRef(null);
  const playerRef = useRef(null);
  const titleId = useId();

  useFilmDialog({ dialogRef, backButtonRef, identifier: movie.identifier, onClose });
  const details = useFilmDetails(movie);
  const related = useRelated(movie, allMovies, (details.tmdbDetails?.genres || []).map(g => g.name));

  // A new film starts on its page, not in the player
  useEffect(() => { setIsPlaying(false); }, [movie]);
  useEffect(() => {
    if (isPlaying && playerRef.current) playerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isPlaying]);

  if (!movie) return null;
  const play = () => setIsPlaying(true);

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); window.history.back(); }}
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-none max-w-none border-0 p-0 bg-ink text-bone overflow-y-auto"
    >
      {details.backdropUrl && (
        <div className="absolute inset-0 h-96 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${details.backdropUrl})` }}>
          <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/80 to-ink" />
        </div>
      )}

      <FilmTopBar movie={movie} backButtonRef={backButtonRef} allMovies={allMovies} onSearch={onSearch} onOpen={onPlayRelated} onPickGenre={onPickGenre} onPickCollection={onPickCollection} />

      <div className="relative gutter max-w-7xl mx-auto py-8 lg:py-10">
        {isPlaying && <NowPlaying movie={movie} onClose={() => setIsPlaying(false)} playerRef={playerRef} />}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          <FilmPoster movie={movie} details={details} playing={isPlaying} onPlay={play} />
          <FilmDetails movie={movie} details={details} titleId={titleId} playing={isPlaying} onPlay={play} onSearch={onSearch} />
        </div>
        <RelatedShelf films={related.films} genre={related.genre} onOpen={onPlayRelated} />
      </div>
    </dialog>
  );
}
