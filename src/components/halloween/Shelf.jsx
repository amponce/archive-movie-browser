import React, { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { DAYS } from '../../halloween/days';
import { posterOf, titleOf } from './parts';

// Tapes per shelf: the whole month on one shelf on a wide screen, 12 on a tablet, 8 on a phone,
// so every spine is wide enough to read and nothing scrolls sideways
const WIDE = '(min-width: 1280px)';
const MEDIUM = '(min-width: 640px)';
const perShelf = () => (window.matchMedia?.(WIDE).matches ? 31 : window.matchMedia?.(MEDIUM).matches ? 12 : 8);
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

// The tape's label: a cream band across the top of the spine with the night's number and the
// tape's length and speed, a little worn, and stuck on not quite straight
const tilt = day => ({ transform: `rotate(${((day.day * 7) % 5 - 2) * 0.35}deg)` });

function TapeLabel({ day, tonight }) {
  return (
    <span className="tape-label absolute top-2 inset-x-[3px] sm:inset-x-[5px] flex flex-col items-center pt-1 pb-[3px] sm:pb-1" style={tilt(day)} aria-hidden="true">
      <span className={`font-display font-black text-lg sm:text-2xl leading-none tabular-nums ${tonight ? 'text-signal' : 'text-ink'}`}>{day.day}</span>
      <span className="mt-0.5 flex flex-wrap justify-center gap-x-[3px] font-mono text-[6px] sm:text-[7px] xl:text-[6px] leading-[1.15] text-ink/60 whitespace-nowrap">
        <span>T-120</span><span>SP</span>
      </span>
    </span>
  );
}

function Spine({ day, entry, tonight, seen, onOpen, active, onFocus, buttonRef }) {
  const title = titleOf(entry, day);
  const label = [`Night ${day.day}`, title, entry?.y, tonight && 'tonight', seen && 'seen'].filter(Boolean).join(', ');
  return (
    <button type="button" ref={buttonRef} tabIndex={active ? 0 : -1} onFocus={onFocus} onClick={event => onOpen(day, event.currentTarget)} aria-label={label} aria-haspopup="dialog"
      className={`relative block w-full ${HEIGHT} rounded-[3px] overflow-hidden bg-panel shadow-[0_8px_16px_-6px_rgba(0,0,0,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-4 motion-safe:focus-visible:-translate-y-4 ${tonight ? 'ring-2 ring-signal motion-safe:-translate-y-2' : ''}`}>
      {posterOf(entry) && <img src={posterOf(entry)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
      <span className="absolute inset-0 bg-gradient-to-b from-ink/90 via-ink/45 to-ink/90" aria-hidden="true" />
      <span className="absolute inset-y-0 left-0 w-px bg-white/15" aria-hidden="true" />
      <span className="absolute inset-y-0 right-0 w-px bg-black/40" aria-hidden="true" />
      <TapeLabel day={day} tonight={tonight} />
      <span className={`absolute inset-x-0 top-[52px] sm:top-[60px] ${seen ? 'bottom-9 sm:bottom-10' : 'bottom-3'} flex items-center justify-center overflow-hidden`} aria-hidden="true">
        <span className="spine-text font-mono text-[9px] sm:text-[11px] font-medium tracking-[0.1em] uppercase text-bone whitespace-nowrap overflow-hidden text-ellipsis max-h-full [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{title}</span>
      </span>
      {seen && (
        <span className="rewind-sticker absolute bottom-2 sm:bottom-2.5 left-1/2 -translate-x-1/2 -rotate-[8deg] font-mono font-semibold text-[6px] sm:text-[7px] leading-[1.1] tracking-[0.03em] text-center whitespace-nowrap px-[3px] py-[2px] rounded-[2px]" aria-hidden="true">
          <span className="block">BE KIND</span><span className="block">REWIND</span>
        </span>
      )}
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

// Nights still to come off the shelf, as one compact block of dates
function StillToCome({ days }) {
  return (
    <div>
      <p className="label mb-3">Still to come</p>
      <ol className="grid grid-cols-9 sm:grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
        {days.map(day => (
          <li key={day.day} className="h-10 rounded-[3px] border border-line/70 bg-panel/50 flex flex-col items-center justify-center gap-0.5 text-dim">
            <span className="font-mono text-[11px] leading-none tabular-nums" aria-hidden="true">{day.day}</span>
            <Lock className="w-2.5 h-2.5" aria-hidden="true" />
            <span className="sr-only">Night {day.day}, opens October {day.day}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// The month as a video-store shelf: an opened night is a tape spine that slides out and opens
// the night's card. On a wide screen the nights to come stand on the same shelf as dark spines;
// narrower, they wait below as a block of dates, so the page is not a wall of empty tapes.
// The shelf is one Tab stop (tonight's spine, or the last one used); the arrow keys, Home and End
// move along the opened spines.
export default function Shelf({ index, opened, tonightDay, seen, onOpen }) {
  const count = usePerShelf();
  const [active, setActive] = useState(null);
  const current = active && active <= opened ? active : tonightDay || 1;
  const spines = useRef({});
  const onKeyDown = event => {
    const to = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 1, End: opened }[event.key];
    if (to === undefined || !opened) return;
    event.preventDefault();
    const next = Math.min(opened, Math.max(1, to));
    setActive(next);
    spines.current[next]?.focus();
    spines.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const whole = count >= DAYS.length;
  const onShelf = whole ? DAYS : DAYS.slice(0, opened);
  const shelves = [];
  for (let i = 0; i < onShelf.length; i += count) shelves.push(onShelf.slice(i, i + count));
  return (
    <div className="flex flex-col gap-10" onKeyDown={onKeyDown}>
      {shelves.map(row => (
        <div key={row[0].day}>
          <ol className="grid gap-1 xl:gap-[3px] items-end pt-5 px-1" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
            {row.map(day => (
              <li key={day.day}>
                {day.day <= opened
                  ? <Spine day={day} entry={index?.[day.film]} tonight={day.day === tonightDay} seen={seen.includes(day.film)} onOpen={onOpen}
                      active={day.day === current} onFocus={() => setActive(day.day)} buttonRef={el => { spines.current[day.day] = el; }} />
                  : <LockedSpine day={day} />}
              </li>
            ))}
          </ol>
          <div className="h-2.5 rounded-[2px] bg-line border-t border-white/10 shadow-[0_10px_20px_-6px_rgba(0,0,0,0.9)]" aria-hidden="true" />
        </div>
      ))}
      {!whole && opened < DAYS.length && <StillToCome days={DAYS.slice(opened)} />}
    </div>
  );
}

