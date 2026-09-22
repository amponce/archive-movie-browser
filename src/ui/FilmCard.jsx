import React from 'react';
import TitleCover from '../components/TitleCover';

// A film in the file: a portrait card with sprocket edges. With a poster the poster fills the
// frame; without one the generated cover (TitleCover, by the community) is the poster.
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

export { fieldFor };

// film: { id, title, year, genre, poster, progress? }   poster is a full image URL or null;
// progress (0..1) draws a line for how far along a film is
// href: where the card goes. children: an optional line under the year (adopters, note)
export default function FilmCard({ film, href, label, onRemove, children }) {
  const genre = film.genre && film.genre !== 'Uncategorized' ? film.genre : null;

  return (
    <div className="relative min-w-0">
    {onRemove && (
      <button type="button" onClick={() => onRemove(film.id)} aria-label={`Remove ${film.title}`} className="absolute top-2 right-3 z-10 w-8 h-8 rounded-full bg-ink/80 text-bone flex items-center justify-center hover:bg-signal hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    )}
    <a href={href} className="group block min-w-0 focus-visible:outline-none">
      <span
        className="film-frame group-hover:border-signal group-focus-visible:border-signal"
        style={{ background: fieldFor(genre, film.id), containerType: 'inline-size' }}
      >
        {film.poster ? (
          <img src={film.poster} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <TitleCover movie={{ title: film.title, year: film.year, identifier: film.id, genres: genre ? [genre] : [] }} size="small" />
        )}
        {label && (
          <span className="absolute top-3 left-4 font-mono text-[10px] tracking-[0.12em] uppercase bg-signal text-ink px-2 py-1 rounded-sm">
            {label}
          </span>
        )}
        {film.progress > 0 && (
          <span aria-hidden="true" className="absolute left-3 right-3 bottom-2 h-0.5 bg-white/20"><span className="block h-full bg-signal" style={{ width: `${Math.round(film.progress * 100)}%` }} /></span>
        )}
        <Sprockets />
      </span>
      <span className="block mt-3 font-sans font-medium text-sm text-bone leading-snug line-clamp-2 group-hover:text-signal">{film.title}</span>
      {film.year && <span className="block mt-0.5 font-mono text-[11px] text-dim tabular-nums">{film.year}</span>}
      {children}
    </a>
    </div>
  );
}
