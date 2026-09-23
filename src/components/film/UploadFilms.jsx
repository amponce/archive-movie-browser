import React, { useEffect, useState } from 'react';
import archiveService from '../../services/archive';
import tmdbService from '../../services/tmdb';
import { filmsInUpload } from '../../services/playback';
import TitleCover from '../TitleCover';

// Some people use one Archive.org upload as a list: many films in one item. Their films, read
// from the upload each time it is opened (nothing is kept on our side), each with its poster
// when TMDB knows the film. Picking one plays that file.
export default function UploadFilms({ movie, playing, onPlay }) {
  const [films, setFilms] = useState(null);
  const [posters, setPosters] = useState({});

  useEffect(() => {
    let cancelled = false;
    setFilms(null);
    setPosters({});
    archiveService.getMetadata(movie.identifier).then(async (data) => {
      const found = filmsInUpload(data.files);
      if (cancelled || !found) return;
      setFilms(found);
      for (const film of found) { // one at a time: tmdbService already spaces and caches its requests
        const match = await tmdbService.searchMovie(film.title, film.year).catch(() => null);
        if (cancelled) return;
        if (match?.posterPath) setPosters(p => ({ ...p, [film.key]: tmdbService.getPosterUrl(match.posterPath, 'small') }));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [movie.identifier]);

  if (!films) return null;
  return (
    <section aria-labelledby="upload-films" className="mt-12 flex flex-col gap-5">
      <div>
        <h2 id="upload-films" className="display text-2xl">{films.length} films in this upload</h2>
        <p className="text-muted mt-1 max-w-[64ch]">Someone keeps a list of films in this one Archive.org upload. Pick one to play it.</p>
      </div>
      <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
        {films.map(film => (
          <li key={film.key}>
            <button type="button" onClick={() => onPlay(film)} aria-pressed={playing?.key === film.key} data-track="upload-film"
              className="group block w-full text-left focus-visible:outline-none">
              <span className={`relative block aspect-[2/3] rounded-sm overflow-hidden bg-line ring-1 group-hover:ring-signal group-focus-visible:ring-2 group-focus-visible:ring-signal ${playing?.key === film.key ? 'ring-2 ring-signal' : 'ring-white/10'}`}>
                {posters[film.key]
                  ? <img src={posters[film.key]} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  : <TitleCover movie={{ title: film.title, year: film.year, identifier: film.key, genres: [] }} size="small" />}
              </span>
              <span className="block mt-2 text-sm text-bone leading-snug line-clamp-2 group-hover:text-signal">{film.title}</span>
              <span className="block text-sm text-dim">{[film.year, film.seconds > 0 && `${Math.round(film.seconds / 60)} min`].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
