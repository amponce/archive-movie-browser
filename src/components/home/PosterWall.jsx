import React from 'react';
import tmdbService from '../../services/tmdb';

// Real posters tiled faintly behind the hero, fading into the page. Decoration only.
// ponytail: forty small image requests on every front-page load; one composite image built
// with the index would make it one request.
export default function PosterWall({ films }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-2 opacity-[0.09] -rotate-3 scale-110 origin-center">
        {films.map(({ id, entry }) => (
          <img key={id} src={tmdbService.getPosterUrl(entry.p, 'small')} alt="" loading="lazy" className="w-full aspect-[2/3] object-cover rounded-sm" />
        ))}
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#0E0E10_75%)]" />
    </div>
  );
}
