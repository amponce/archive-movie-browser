import React, { useEffect, useState } from 'react';
import { loadRankedCollections, showable } from '../../services/collectionBest';
import { loadPosterIndex } from '../../services/posterIndex';
import tmdbService from '../../services/tmdb';

// On All Films: the Archive.org collections we have ranked (public/collections.json), biggest
// first, each as three of its best posters and a way in to "The best of" it. So nobody has to
// know that collections exist to find them.
export default function CollectionsRow() {
  const [tiles, setTiles] = useState(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadRankedCollections(), loadPosterIndex()]).then(([rankings, index]) => {
      if (cancelled) return;
      setTiles(Object.entries(rankings)
        .filter(([id]) => !id.startsWith('genre:'))
        .sort((a, b) => b[1].identified - a[1].identified)
        .map(([id, c]) => ({ id, title: c.title, count: c.identified, posters: c.films.filter(f => showable(f, index[f])).slice(0, 3).map(f => index[f].p) }))
        .filter(t => t.posters.length === 3));
    });
    return () => { cancelled = true; };
  }, []);
  if (!tiles?.length) return null;

  return (
    <section id="collections" aria-labelledby="collections-title" className="flex flex-col gap-4 mb-8 scroll-mt-24">
      <div>
        <h2 id="collections-title" className="display text-2xl">Browse by collection</h2>
        <p className="text-muted mt-1">Collections people built on Archive.org, and the best films in each.</p>
      </div>
      <ul className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
        {tiles.map(t => (
          <li key={t.id} className="shrink-0 w-[168px] snap-start">
            <a href={`/details/${t.id}`} data-track="collection-tile" className="group block focus-visible:outline-none">
              <span className="relative block h-[132px] rounded-md bg-panel ring-1 ring-white/10 group-hover:ring-signal group-focus-visible:ring-2 group-focus-visible:ring-signal overflow-hidden">
                {t.posters.map((p, i) => (
                  <img key={p} src={tmdbService.getPosterUrl(p, 'small')} alt="" loading="lazy"
                    className="absolute top-3 w-[68px] aspect-[2/3] rounded-sm object-cover shadow-[0_8px_16px_-6px_rgba(0,0,0,0.8)]"
                    style={{ left: `${12 + i * 40}px`, zIndex: 3 - i }} />
                ))}
              </span>
              <span className="block mt-2 text-sm text-bone leading-snug line-clamp-2 group-hover:text-signal">{t.title}</span>
              <span className="block text-sm text-dim">{t.count.toLocaleString('en-US')} films</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
