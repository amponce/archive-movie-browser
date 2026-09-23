import React from 'react';
import tmdbService from '../../services/tmdb';
import { watchUrl } from '../../services/reel';
import Button from '../../ui/Button';

// The front of the shop: one curated list, face out like the new-releases wall of a video store,
// and a way deeper than the list. `list` is a list from src/lists, `more` its { label, href }
// from src/programme/shelves.json.
export default function Shelf({ list, index, more }) {
  const films = list.films.map(f => ({ id: f.id, entry: index[f.id] })).filter(f => f.entry?.p);
  const hours = Math.round(films.reduce((sum, f) => sum + (f.entry.l || 0), 0) / 60);

  return (
    <section id="shelf" className="rule overflow-hidden">
      {/* On a phone the posters come straight after the title, so the films are on the first screen */}
      <div className="gutter pt-8 lg:pt-14 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-6 lg:gap-y-10 items-end">
        <h1 className="lg:col-span-7 lg:row-start-1 font-display font-black uppercase leading-[0.86] text-[48px] sm:text-[84px] lg:text-[104px]">{list.title}</h1>
        <div className="lg:col-span-5 lg:row-start-1 lg:pb-3 flex flex-col gap-5 order-3 lg:order-none">
          <p className="text-lg text-muted leading-relaxed max-w-[52ch]">{list.blurb}</p>
          <p className="text-bone">{films.length} films{hours ? `, about ${hours} hours` : ''}, picked by {list.curator}.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button href={more.href} size="lg">{more.label}</Button>
            <Button href={`/lists/${list.slug}`} variant="ghost" size="lg">Open the list</Button>
          </div>
        </div>
        <ol aria-label={`The films in ${list.title}`} className="lg:col-span-12 lg:row-start-2 order-2 lg:order-none flex gap-3 sm:gap-4 overflow-x-auto lg:overflow-visible pb-6 -mx-4 px-4 scroll-px-4 sm:mx-0 sm:px-0 sm:scroll-px-0 snap-x border-b-2 border-bone/15">
          {films.map(({ id, entry }) => (
            <li key={id} className="shrink-0 w-[132px] sm:w-[156px] lg:w-auto lg:flex-1 lg:min-w-0 snap-start">
              <a href={watchUrl(id)} className="group block focus-visible:outline-none">
                <span className="relative block aspect-[2/3] rounded-sm overflow-hidden bg-line shadow-[0_14px_28px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/10 group-hover:ring-signal group-focus-visible:ring-2 group-focus-visible:ring-signal transition-transform duration-200 group-hover:-translate-y-1.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                  <img src={tmdbService.getPosterUrl(entry.p, 'medium')} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                </span>
                <span className="block mt-3 text-sm text-bone leading-snug line-clamp-2 group-hover:text-signal">{entry.t}</span>
                {entry.y && <span className="block text-sm text-dim">{entry.y}</span>}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
