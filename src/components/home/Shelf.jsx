import React from 'react';
import tmdbService from '../../services/tmdb';
import { watchUrl } from '../../services/reel';
import Button from '../../ui/Button';

// The front of the shop: one curated list, face out like the new-releases wall of a video store,
// and a way deeper than the list. `list` is a list from src/lists, `more` its { label, href }
// from src/programme/shelves.json. The page's lead is its h1; `lead={false}` for one further down,
// and `last` for one right above the footer, which has a rule of its own. The lead also says
// when it changes (`next`: { at, title }) and, under the films, the `range` of everything else,
// so nobody takes one shelf for the whole site.
export default function Shelf({ list, index, more, lead = true, last = false, next = null, range = [] }) {
  const Title = lead ? 'h1' : 'h2';
  const track = lead ? 'lead' : 'shelf';
  // Ten posters, like the westerns, or two rows of ten when the list has twenty or more (a
  // generated channel holds a week's worth); the rest is a click away on the list
  const all = list.films.map(f => ({ id: f.id, entry: index[f.id] })).filter(f => f.entry?.p);
  const films = all.slice(0, all.length >= 20 ? 20 : 10);
  const hours = Math.round(films.reduce((sum, f) => sum + (f.entry.l || 0), 0) / 60);

  return (
    <section id={lead ? 'shelf' : list.slug} className={`${last ? '' : 'rule '}overflow-hidden`}>
      {/* On a phone the posters come straight after the title, so the films are on the first screen.
          Rows of ten on a wide screen (the second only there), two rows of five below that, and the
          first six in threes on a phone. */}
      <div className="gutter pt-8 lg:pt-14 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-6 lg:gap-y-10 items-end">
        <Title className="lg:col-span-7 lg:row-start-1 font-display font-black uppercase leading-[0.86] text-[48px] sm:text-[84px] lg:text-[104px]">{list.title}</Title>
        <div className="lg:col-span-5 lg:row-start-1 lg:pb-3 flex flex-col gap-5 order-4 lg:order-none">
          {next && <p className="label">Until {next.at.toLocaleTimeString([], { hour: 'numeric' })} · Next: {next.title}</p>}
          <p className="text-lg text-muted leading-relaxed max-w-[52ch]">{list.blurb}</p>
          <p className="text-bone">{films.length} films{hours ? `, about ${hours} hours` : ''}, picked by {list.curator}.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button href={more.href} size="lg" data-track={`${track}-more`}>{more.label}</Button>
            <Button href={`/lists/${list.slug}`} variant="ghost" size="lg" data-track={`${track}-list`}>Open the list</Button>
          </div>
        </div>
        {range.length > 0 && (
          <nav aria-label="Everything else on the site" className="lg:col-span-12 lg:row-start-2 order-2 lg:order-none -my-2 lg:-mt-4 flex items-center gap-x-5 overflow-x-auto whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
            <span className="text-sm text-muted shrink-0">Also here:</span>
            {range.map(r => <a key={r.href} href={r.href} data-track="lead-range" className="label hover:text-bone inline-flex items-center min-h-[44px] shrink-0">{r.label}</a>)}
          </nav>
        )}
        <ol aria-label={`The films in ${list.title}`} className={`lg:col-span-12 lg:row-start-3 order-3 lg:order-none grid grid-cols-3 sm:grid-cols-5 xl:grid-cols-10 gap-x-3 gap-y-6 sm:gap-x-4 pb-6 ${last ? '' : 'border-b-2 border-bone/15'}`}>
          {films.map(({ id, entry }, i) => (
            <li key={id} className={`min-w-0 ${i >= 10 ? 'hidden xl:block' : i >= 6 ? 'hidden sm:block' : ''}`}>
              <a href={watchUrl(id)} data-track={`${track}-poster`} data-film={id} className="group block focus-visible:outline-none">
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
