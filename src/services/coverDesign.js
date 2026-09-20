// Generated posters for films with no TMDB poster. The look is a mid-century cut-paper
// reissue series: a flat colour field, one bold shape, and the title in heavy condensed type.
// Everything is derived from the film itself, so a film always gets the same cover.
import { titleCandidates } from './movieMatching.js';

export const COMPOSITIONS = ['disc', 'beam', 'rings', 'stairs', 'horizon'];

// field = background, shape = the cut-paper form, ink = title, note = year
const PALETTES = {
  horror: [
    { field: '#1a0b0e', shape: '#b3121d', ink: '#f3e9dc', note: '#d9a9a0' },
    { field: '#8f0f18', shape: '#16090b', ink: '#f6ecdf', note: '#f0bdb4' },
    { field: '#e6e1d3', shape: '#b3121d', ink: '#1a0b0e', note: '#5e4b45' }, // printed on paper stock
  ],
  scifi: [
    { field: '#0b2a33', shape: '#f08a24', ink: '#e8f1ee', note: '#9fc4c0' },
    { field: '#12343b', shape: '#7fd6c8', ink: '#f2f6f3', note: '#a9cfc8' },
    { field: '#e3e6df', shape: '#0f5563', ink: '#0b2a33', note: '#4a6063' }, // printed on paper stock
  ],
  noir: [
    { field: '#101114', shape: '#e8e2d0', ink: '#f2ede0', note: '#a8a394' },
    { field: '#1d2026', shape: '#eab308', ink: '#f1ece0', note: '#a9a699' },
    { field: '#e6e1d3', shape: '#101114', ink: '#101114', note: '#55524a' }, // printed on paper stock
  ],
  western: [
    { field: '#c8892b', shape: '#6b2a12', ink: '#1c1208', note: '#4a2e12' },
    { field: '#7a3515', shape: '#e3a542', ink: '#fbf0dc', note: '#ecc892' },
    { field: '#ead9b5', shape: '#a3401a', ink: '#2a1608', note: '#6b4a2a' }, // printed on paper stock
  ],
  comedy: [
    { field: '#e7b53c', shape: '#c53a60', ink: '#1b1b1b', note: '#4a3a12' },
    { field: '#1f3a5f', shape: '#e7b53c', ink: '#f6f1e4', note: '#b9c6d8' },
    { field: '#f0e6d2', shape: '#1f3a5f', ink: '#1b1b1b', note: '#5a5346' }, // printed on paper stock
  ],
  animation: [
    { field: '#2356a8', shape: '#f2c230', ink: '#ffffff', note: '#c5d6f2' },
    { field: '#b3331c', shape: '#f5d76e', ink: '#fff7e6', note: '#f3c4b3' },
    { field: '#f1ead6', shape: '#2356a8', ink: '#15233d', note: '#55607a' }, // printed on paper stock
  ],
  drama: [
    { field: '#2f3b35', shape: '#c9b891', ink: '#f0ead8', note: '#aab3a5' },
    { field: '#4a2f3a', shape: '#d8b9a0', ink: '#f4ece4', note: '#c4a9b0' },
    { field: '#e4e0d2', shape: '#2f3b35', ink: '#1f2723', note: '#565c55' }, // printed on paper stock
  ],
  house: [
    { field: '#26262b', shape: '#eab308', ink: '#f5f5f4', note: '#a8a8ad' },
    { field: '#33302a', shape: '#d97706', ink: '#f6f2ea', note: '#b3ab9c' },
    { field: '#e6e1d3', shape: '#ca8a04', ink: '#1c1c20', note: '#5a5850' }, // printed on paper stock
  ],
};

// First matching genre decides the family, in this order of visual distinctiveness
const FAMILY_BY_GENRE = [
  ['Horror', 'horror'], ['Sci-Fi', 'scifi'], ['Fantasy', 'scifi'],
  ['Film Noir', 'noir'], ['Crime', 'noir'], ['Mystery', 'noir'], ['Thriller', 'noir'],
  ['Western', 'western'], ['Animation', 'animation'], ['Family', 'animation'],
  ['Comedy', 'comedy'], ['Musical', 'comedy'], ['Music', 'comedy'], ['Romance', 'comedy'],
  ['Drama', 'drama'], ['History', 'drama'], ['War', 'drama'], ['Documentary', 'drama'],
  ['Adventure', 'western'], ['Action', 'western'], ['Sport', 'drama'], ['Short', 'house'],
];

// Small stable string hash (FNV-1a); only needs to spread films across a few choices
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export function coverDesign(movie) {
  const genres = movie.genres || [];
  const family = FAMILY_BY_GENRE.find(([genre]) => genres.includes(genre))?.[1] || 'house';
  const seed = hash(String(movie.identifier || movie.title || ''));
  const title = titleCandidates(movie.title || '')[0].query || String(movie.title || '');

  return {
    family,
    palette: PALETTES[family][seed % PALETTES[family].length],
    composition: COMPOSITIONS[(seed >>> 3) % COMPOSITIONS.length],
    flipped: Boolean((seed >>> 7) & 1),
    title,
    // 1 = largest. Condensed type lets short titles go big and long ones still fit.
    titleScale: title.length <= 10 ? 1 : title.length <= 22 ? 0.84 : title.length <= 40 ? 0.68 : 0.54,
  };
}
