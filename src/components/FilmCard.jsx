import React from 'react';

// A film in the file: a portrait card with sprocket edges. With a poster the poster fills the
// frame; without one the card is the poster, the title set large in the genre's colour.
// Same frame either way, so a row of mixed films reads as one row.

const FIELDS = {
  Horror: '#3A1420', 'Film Noir': '#1A2233', Mystery: '#1A2233', Crime: '#1A2233', Thriller: '#1A2233',
  Action: '#3B2414', Adventure: '#3B2414', Western: '#3B2414', War: '#3B2414',
  Comedy: '#3B3418', Musical: '#3B3418', Music: '#3B3418', Romance: '#3B3418',
  Animation: '#1C3A2C', Family: '#1C3A2C', Fantasy: '#1C3A2C',
  'Sci-Fi': '#123A4A', Documentary: '#2C2C31', Drama: '#2C1A3A',
};
const FALLBACK = Object.values(FIELDS);

function fieldFor(genre, seed) {
  if (FIELDS[genre]) return FIELDS[genre];
  let h = 0;
  for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

// The film-leader perforations down both edges
export function Sprockets() {
  const edge = 'absolute top-0 bottom-0 w-3 pointer-events-none';
  const holes = { background: 'repeating-linear-gradient(180deg, rgba(242,239,230,0.18) 0 12px, transparent 12px 28px)' };
  return (
    <>
      <span aria-hidden="true" className={`${edge} left-0`} style={holes} />
      <span aria-hidden="true" className={`${edge} right-0`} style={holes} />
    </>
  );
}

// film: { id, title, year, genre, poster }   poster is a full image URL or null
// href: where the card goes. children: an optional line under the year (adopters, note)
export default function FilmCard({ film, href, label, children }) {
  const genre = film.genre && film.genre !== 'Uncategorized' ? film.genre : null;
  const meta = [film.year, genre].filter(Boolean).join(' · ');

  return (
    <a href={href} className="group block min-w-0 focus-visible:outline-none">
      <span
        className="relative block aspect-[2/3] rounded-md overflow-hidden border border-white/[0.06] group-hover:border-signal group-focus-visible:border-signal transition-colors"
        style={{ background: fieldFor(genre, film.id), containerType: 'inline-size' }}
      >
        {film.poster ? (
          <img src={film.poster} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-x-6 bottom-5 top-5 flex flex-col justify-end gap-2">
            {meta && <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted">{meta}</span>}
            <span className="font-display font-black uppercase text-bone leading-[0.86] break-words line-clamp-6" style={{ fontSize: film.title.length > 40 ? 'clamp(16px, 11cqw, 30px)' : 'clamp(22px, 15cqw, 44px)' }}>
              {film.title}
            </span>
          </span>
        )}
        {label && (
          <span className="absolute top-3 left-4 font-mono text-[10px] tracking-[0.12em] uppercase bg-signal text-ink px-2 py-1 rounded-sm">
            {label}
          </span>
        )}
        <Sprockets />
      </span>
      <span className="block mt-3 font-sans font-medium text-sm text-bone leading-snug line-clamp-2 group-hover:text-signal">{film.title}</span>
      {film.year && <span className="block mt-0.5 font-mono text-[11px] text-dim tabular-nums">{film.year}</span>}
      {children}
    </a>
  );
}
