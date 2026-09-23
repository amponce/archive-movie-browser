import React, { useEffect, useState } from 'react';
import { programmesBetween } from '../../services/schedule';

const NARROW = '(max-width: 639px)';
const clock = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// How much of the future the guide shows: three hours, or ninety minutes on a phone, where three
// hours squeezes every title to a letter. `label` is the same span in words.
export function useGuideSpan() {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(NARROW).matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.(NARROW);
    if (!query) return undefined;
    const change = e => setNarrow(e.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return narrow ? { hours: 1.5, label: 'the next 90 minutes' } : { hours: 3, label: 'the next three hours' };
}

// The guide: one row per channel, `hours` across, the programme on air now tinted up to now.
// lead: how much of the past to show before now, so now sits inside the grid, not on its edge.
// Programmes come from each channel's lineup and the shared clock, so the grid never goes stale.
export default function Guide({ channels, current, now, onTune, hours = 3, lead = 0 }) {
  const from = now - lead;
  const to = from + hours * 3600_000;
  const span = to - from;
  const left = ms => `${Math.max(0, ((ms - from) / span) * 100)}%`;
  const width = (a, b) => `${((Math.min(b, to) - Math.max(a, from)) / span) * 100}%`;
  // Times on the half hour, like a printed guide, none so close to the end that it gets cut off
  const ticks = [];
  for (let t = Math.ceil(from / 1800_000) * 1800_000; t < to - 1200_000; t += 1800_000) {
    if (!lead || Math.abs(t - now) > 900_000) ticks.push(t); // leave room for the NOW tag
  }
  const programmesOf = channel => (channel.lineup
    ? programmesBetween(channel.lineup, from, to).map(p => ({ id: p.film.id, title: p.film.title, startsAt: p.startsAt, endsAt: p.endsAt }))
    : channel.programmes);

  return (
    <div className="flex flex-col">
      <div className="hidden sm:grid grid-cols-[200px_1fr] gap-4 mb-2">
        <span />
        <div className="relative h-5">
          {ticks.map(t => <span key={t} className="absolute label -translate-x-1/2" style={{ left: left(t) }}>{clock(t)}</span>)}
          {lead > 0 && <span className="absolute -translate-x-1/2 -top-0.5 font-mono text-[10px] tracking-[0.12em] uppercase text-ink bg-signal px-1.5 py-0.5 rounded-sm" style={{ left: left(now) }}>Now</span>}
        </div>
      </div>
      {channels.map(channel => (
        <button key={channel.id} type="button" data-track="guide-row" onClick={() => onTune(channel)} aria-current={channel.id === current?.id ? 'true' : undefined}
          className={`group grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 sm:gap-4 py-3 border-t border-line text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal ${channel.id === current?.id ? 'bg-panel shadow-[inset_3px_0_0_#FF5A2E]' : 'hover:bg-panel/40'}`}>
          <span className="flex items-baseline gap-3 px-2 min-w-0">
            <span className="font-display font-black text-2xl tabular-nums text-dim group-aria-[current]:text-signal">{channel.number}</span>
            <span className="font-medium text-sm text-bone truncate">{channel.name}</span>
          </span>
          <span className="relative h-14 overflow-hidden">
            {programmesOf(channel).map(p => (
              <span key={`${p.id}-${p.startsAt}`} className={`absolute top-0 bottom-0 flex flex-col justify-center px-3 rounded-md border overflow-hidden ${p.startsAt <= now && now < p.endsAt ? 'bg-signal/10 border-signal/40' : 'bg-panel border-line'}`} style={{ left: left(p.startsAt), width: width(p.startsAt, p.endsAt) }}>
                {p.startsAt <= now && now < p.endsAt && <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-signal/15" style={{ width: `${((now - Math.max(p.startsAt, from)) / (Math.min(p.endsAt, to) - Math.max(p.startsAt, from))) * 100}%` }} />}
                <span className="relative text-sm text-bone truncate">{p.title}</span>
                <span className="relative label truncate">{clock(p.startsAt)} – {clock(p.endsAt)}</span>
              </span>
            ))}
          </span>
        </button>
      ))}
    </div>
  );
}

