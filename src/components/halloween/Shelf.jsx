import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { DAYS } from '../../halloween/days';
import { posterOf, titleOf } from './parts';

// Tapes per shelf: the whole month on one shelf on a wide screen, two shelves on a tablet, three
// on a phone, so every spine is wide enough to read and nothing scrolls sideways
const WIDE = '(min-width: 1280px)';
const MEDIUM = '(min-width: 640px)';
const perShelf = () => (window.matchMedia?.(WIDE).matches ? 31 : window.matchMedia?.(MEDIUM).matches ? 16 : 11);
function usePerShelf() {
  const [count, setCount] = useState(perShelf);
  useEffect(() => {
    const queries = [WIDE, MEDIUM].map(q => window.matchMedia?.(q)).filter(Boolean);
    const update = () => setCount(perShelf());
    queries.forEach(q => q.addEventListener('change', update));
    return () => queries.forEach(q => q.removeEventListener('change', update));
  }, []);
  return count;
}

const HEIGHT = 'h-[184px] sm:h-[248px] xl:h-[300px]';

function Spine({ day, entry, tonight, seen, onOpen }) {
  const title = titleOf(entry, day);
  const label = `Night ${day.day}: ${title}${tonight ? ', tonight' : ''}${seen ? ', seen' : ''}`;
  return (
    <button type="button" onClick={event => onOpen(day, event.currentTarget)} aria-label={label} aria-haspopup="dialog"
      className={`relative block w-full ${HEIGHT} rounded-[3px] overflow-hidden bg-panel shadow-[0_8px_16px_-6px_rgba(0,0,0,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-4 motion-safe:focus-visible:-translate-y-4 ${tonight ? 'ring-2 ring-signal motion-safe:-translate-y-2' : ''}`}>
      {posterOf(entry) && <img src={posterOf(entry)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
      <span className="absolute inset-0 bg-gradient-to-b from-ink/95 via-ink/50 to-ink/90" aria-hidden="true" />
      <span className="absolute inset-y-0 left-0 w-px bg-white/15" aria-hidden="true" />
      <span className={`absolute top-1.5 inset-x-0 text-center font-display font-black text-lg sm:text-2xl leading-none ${tonight ? 'text-signal' : 'text-bone'}`} aria-hidden="true">{day.day}</span>
      <span className="absolute inset-x-0 top-9 sm:top-10 bottom-8 flex items-center justify-center overflow-hidden" aria-hidden="true">
        <span className="spine-text font-mono text-[9px] sm:text-[11px] font-medium tracking-[0.1em] uppercase text-bone whitespace-nowrap overflow-hidden text-ellipsis max-h-full [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{title}</span>
      </span>
      {seen && <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 -rotate-6 bg-signal text-ink font-mono text-[7px] sm:text-[8px] font-medium tracking-[0.04em] px-[2px] sm:px-[3px] py-px rounded-[1px] shadow" aria-hidden="true">SEEN</span>}
    </button>
  );
}

function LockedSpine({ day }) {
  return (
    <div className={`relative ${HEIGHT} rounded-[3px] border border-line/70 bg-panel/50 flex flex-col items-center justify-between py-3 text-dim`}>
      <span className="spine-text font-mono text-[9px] sm:text-[10px] tracking-[0.14em] uppercase" aria-hidden="true">Oct {day.day}</span>
      <Lock className="w-3 h-3" aria-hidden="true" />
      <span className="sr-only">Night {day.day}, opens October {day.day}</span>
    </div>
  );
}

// The month as a video-store shelf: an opened night is a tape spine that slides out and opens
// the night's card; a night still to come is a dark spine with its date
export default function Shelf({ index, opened, tonightDay, seen, onOpen }) {
  const count = usePerShelf();
  const shelves = [];
  for (let i = 0; i < DAYS.length; i += count) shelves.push(DAYS.slice(i, i + count));
  return (
    <div className="flex flex-col gap-10">
      {shelves.map(row => (
        <div key={row[0].day}>
          <ol className="grid gap-1 xl:gap-[3px] items-end pt-5 px-1" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
            {row.map(day => (
              <li key={day.day}>
                {day.day <= opened
                  ? <Spine day={day} entry={index?.[day.film]} tonight={day.day === tonightDay} seen={seen.includes(day.film)} onOpen={onOpen} />
                  : <LockedSpine day={day} />}
              </li>
            ))}
          </ol>
          <div className="h-2.5 rounded-[2px] bg-line border-t border-white/10 shadow-[0_10px_20px_-6px_rgba(0,0,0,0.9)]" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
