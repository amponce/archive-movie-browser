import React, { useEffect, useState } from 'react';
import Section from '../../ui/Section';

// What is on television right now: one tile per channel with the film that is playing.
// Tapping a tile opens the set on that channel.
export default function OnNow() {
  const [channels, setChannels] = useState(null);
  useEffect(() => {
    fetch('/api/tv').then(r => (r.ok ? r.json() : { channels: [] })).then(d => setChannels(d.channels.filter(c => c.now))).catch(() => setChannels([]));
  }, []);
  if (channels && channels.length === 0) return null;

  return (
    <Section id="on-now" eyebrow="On now" title="Live channels" blurb="Every channel runs round the clock, the same for everyone. Tune in mid-film, like real television." more="Guide" href="/tv">
      <ol className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
        {(channels || Array.from({ length: 6 }, (_, i) => ({ id: `c${i}` }))).map(channel => (
          <li key={channel.id} className="shrink-0 w-[260px] snap-start">
            {channels ? (
              <a href={`/tv#${channel.id}`} className="group flex gap-3 p-3 panel hover:border-signal focus-visible:outline-none focus-visible:border-signal transition-colors">
                <span className="relative w-16 aspect-[2/3] shrink-0 rounded-sm overflow-hidden bg-line">
                  {channel.now.film.poster && <img src={channel.now.film.poster} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
                </span>
                <span className="min-w-0 flex flex-col justify-between py-0.5">
                  <span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-display font-black text-xl tabular-nums text-signal">{channel.number}</span>
                      <span className="text-sm font-medium text-bone truncate group-hover:text-signal">{channel.name}</span>
                    </span>
                    <span className="block mt-1 text-sm text-muted line-clamp-2">{channel.now.film.title}</span>
                  </span>
                  <span className="label flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-signal" aria-hidden="true" />{Math.floor(channel.now.offset / 60)} min in</span>
                </span>
              </a>
            ) : <span className="block h-[120px] panel animate-pulse" />}
          </li>
        ))}
      </ol>
    </Section>
  );
}
