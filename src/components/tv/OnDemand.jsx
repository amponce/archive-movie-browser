import React from 'react';
import { ChevronDown, Play } from 'lucide-react';
import { onAirAt } from '../../services/schedule';

const length = s => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.round(s / 60)} min`);

// Under the set on a person's own channels: every film in the lineup, in order, each one playable
// from its start. Folded away until asked for.
export default function OnDemand({ channel, playing, onPlay }) {
  const live = onAirAt(channel.lineup)?.film.id;
  return (
    <details className="group border-b border-line pb-4">
      <summary className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="label text-bone">All films on this channel <span className="text-dim">({channel.lineup.length})</span></span>
        <ChevronDown size={16} aria-hidden="true" className="text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <ol className="flex flex-col gap-1 mt-2 max-h-[420px] overflow-y-auto pr-1">
        {channel.lineup.map((film, i) => (
          <li key={`${film.id}-${i}`}>
            <button type="button" onClick={() => onPlay(film)} aria-current={playing === film.id ? 'true' : undefined} aria-label={`Play ${film.title} from the start`}
              className={`group/row w-full flex items-center gap-3 p-2 rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:border-signal ${playing === film.id ? 'border-signal bg-panel' : 'border-transparent hover:border-line'}`}>
              <span className="w-6 shrink-0 text-right label tabular-nums">{i + 1}</span>
              <span className="relative w-8 aspect-[2/3] shrink-0 rounded-sm overflow-hidden bg-line">
                {film.poster && <img src={film.poster} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-bone truncate">{film.title}{film.year ? <span className="text-dim"> {film.year}</span> : null}</span>
                <span className="block label truncate">{length(film.seconds)}{live === film.id ? ' · on now' : ''}</span>
              </span>
              <Play size={16} aria-hidden="true" className="shrink-0 text-muted group-hover/row:text-signal" />
            </button>
          </li>
        ))}
      </ol>
    </details>
  );
}
