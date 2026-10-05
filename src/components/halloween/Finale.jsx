import React from 'react';
import { Tv } from 'lucide-react';
import { Sprockets } from '../../ui/FilmCard';
import Button from '../../ui/Button';
import { watchUrl } from '../../services/reel';
import { DAYS, ranked, crowdShare, CROWD_MIN } from '../../halloween/days';
import { posterOf, titleOf, CrowdBar } from './parts';

function Pick({ label, day, entry, share }) {
  return (
    <a href={watchUrl(day.film)} className="panel p-4 grid grid-cols-[72px_1fr] gap-4 items-center hover:border-bone/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
      <span className="film-frame bg-ink">{posterOf(entry) && <img src={posterOf(entry)} alt="" className="w-full h-full object-cover" />}</span>
      <span className="min-w-0 flex flex-col gap-2">
        <span className="eyebrow">{label}</span>
        <span className="font-display font-black uppercase leading-[0.9] text-2xl text-bone break-words">{titleOf(entry, day)}</span>
        <CrowdBar share={share} />
      </span>
    </a>
  );
}

// From October 31: the month done. With enough ticks, what everyone saw most and least; while
// it is still October, the Halloween channel plays them all, most seen first.
export function FinaleHero({ index, crowd, onAir }) {
  const counted = crowd?.people >= CROWD_MIN;
  const order = ranked(crowd?.seen);
  const lead = counted ? order[0] : DAYS.at(-1);
  const poster = posterOf(index?.[lead.film], 'large');
  return (
    <section className="relative overflow-hidden rule">
      {poster && <img src={poster} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-70 md:opacity-40 lg:opacity-30" />}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/30 md:bg-gradient-to-r md:from-ink md:via-ink/90 md:to-ink/40" aria-hidden="true" />
      <div className="relative gutter grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] lg:grid-cols-[minmax(0,1fr)_380px] gap-8 lg:gap-12 py-10 sm:py-14 lg:py-16 items-center">
        <div className="flex flex-col gap-6">
          <h1 className="eyebrow flex items-center"><span className="inline-block w-2 h-2 rounded-full bg-signal mr-2" aria-hidden="true" />31 Days of Horror</h1>
          <p className="font-display font-black uppercase leading-[0.8] text-[88px] sm:text-[120px] lg:text-[168px] text-bone">
            <span className="text-signal flicker">31</span> nights
          </p>
          <p className="text-lg text-muted leading-relaxed max-w-xl">
            {counted ? `${crowd.people} people ticked the films they'd seen. Here's how the month went.` : 'Every night is open. Tick the ones you\'ve seen.'}
            {onAir && ' All 31 back to back on the Halloween channel, most seen first.'}
          </p>
          {onAir && <div><Button href="/tv#halloween" size="lg" data-track="halloween-tune-in"><Tv className="w-4 h-4" aria-hidden="true" /> Tune in</Button></div>}
          {counted && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Pick label="Most seen" day={order[0]} entry={index?.[order[0].film]} share={crowdShare(crowd, order[0].film)} />
              <Pick label="The one almost nobody had seen" day={order.at(-1)} entry={index?.[order.at(-1).film]} share={crowdShare(crowd, order.at(-1).film)} />
            </div>
          )}
        </div>
        <a href={watchUrl(lead.film)} tabIndex={-1} aria-hidden="true"
          className="hidden md:block relative w-full aspect-[2/3] rounded-lg overflow-hidden border border-white/[0.08] bg-panel shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
          {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <Sprockets />
        </a>
      </div>
    </section>
  );
}

// Every film by how many have seen it
export function Ranking({ index, crowd }) {
  if (!(crowd?.people >= CROWD_MIN)) return null;
  return (
    <section className="gutter pt-12" aria-labelledby="ranking-title">
      <h2 id="ranking-title" className="display text-3xl sm:text-4xl text-bone">The ranking</h2>
      <ol className="mt-5 grid lg:grid-cols-2 gap-x-12">
        {ranked(crowd.seen).map((day, i) => {
          const share = crowdShare(crowd, day.film);
          return (
            <li key={day.film} className="border-b border-line">
              <a href={watchUrl(day.film)} className="grid grid-cols-[2.5rem_1fr_5rem] sm:grid-cols-[2.5rem_1fr_8rem] items-center gap-3 py-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                <span className="font-display font-black text-2xl text-dim tabular-nums">{i + 1}</span>
                <span className="min-w-0 truncate text-bone group-hover:text-signal">{titleOf(index?.[day.film], day)}</span>
                <span className="flex items-center gap-2">
                  <span className="flex-1 h-1 rounded-full bg-line overflow-hidden" aria-hidden="true"><span className="block h-full bg-signal" style={{ width: `${share}%` }} /></span>
                  <span className="font-mono text-[11px] text-muted tabular-nums w-9 text-right">{share}%</span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
