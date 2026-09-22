import React, { useState } from 'react';
import FilmRow from './FilmRow';
import Section from '../../ui/Section';
import { unfinished, readPositions, forgetPosition, POSITIONS_KEY } from '../../services/playback';
import { cardFromIndex } from '../../services/rows';
import { watchUrl } from '../../services/reel';

// Films this browser started and did not finish. Positions live in localStorage, so this is
// per device and needs no account. Each one can be removed. One or two show as a line, not a
// six-wide grid with a hole in it.
const HEADING = { id: 'continue', eyebrow: 'Pick up where you left off', title: 'Continue watching', blurb: 'Kept on this device. Nothing is sent anywhere.' };
const mins = s => `${Math.round(s / 60)} min`;

export default function ContinueWatching({ index }) {
  const [saved, setSaved] = useState(readPositions);
  const films = unfinished(saved)
    .filter(f => index[f.identifier]?.p)
    .map(f => ({ ...cardFromIndex({ id: f.identifier, entry: index[f.identifier] }), time: f.time, progress: f.time / f.duration }));
  if (!films.length) return null;

  const remove = (id) => {
    const next = forgetPosition(saved, id);
    try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    setSaved(next);
  };

  if (films.length < 3) {
    return (
      <Section {...HEADING}>
        <ul className="flex flex-col gap-2">
          {films.map(film => (
            <li key={film.id} className="panel flex items-center gap-4 p-3">
              <a href={watchUrl(film.id)} className="relative w-12 aspect-[2/3] shrink-0 rounded-sm overflow-hidden bg-line">
                <img src={film.poster} alt="" className="absolute inset-0 w-full h-full object-cover" />
              </a>
              <a href={watchUrl(film.id)} className="min-w-0 flex-1 group">
                <span className="block font-medium text-bone truncate group-hover:text-signal">{film.title}{film.year ? <span className="text-dim font-normal"> {film.year}</span> : null}</span>
                <span className="label">{mins(film.time)} in</span>
              </a>
              <a href={watchUrl(film.id)} className="btn-ghost h-9 px-4 hidden sm:inline-flex">Resume</a>
              <button type="button" onClick={() => remove(film.id)} aria-label={`Remove ${film.title} from continue watching`} className="nav-link hover:text-signal px-2">Remove</button>
            </li>
          ))}
        </ul>
      </Section>
    );
  }
  return <FilmRow {...HEADING} cards={films} onRemove={remove} />;
}
