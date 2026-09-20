import React from 'react';
import { coverDesign } from '../services/coverDesign';

// A generated poster for films with no TMDB poster: a mid-century cut-paper reissue series.
// Flat colour field, one bold shape, the film's name in heavy condensed type. Colour follows
// the genre and the shape follows the film's identifier, so a film always gets the same cover.
// Positioned absolutely: the parent must be `relative` and have a fixed size. The title is sized
// in container units, so the same cover works on a 120px related card and a 420px detail poster.
// size: 'full' (grid, detail), 'small' (related cards), 'thumb' (80px list: the art without text)

// Faint printed-paper grain so flat colour reads as ink on paper, not as a CSS fill
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Each composition is one shape, drawn in the palette's `shape` colour
function shapeStyle(composition, color) {
  switch (composition) {
    case 'disc': // a low sun, partly off the sheet
      return { top: '-12%', right: '-28%', width: '105%', aspectRatio: '1', borderRadius: '50%', background: color };
    case 'beam': // a spotlight falling from the top corner
      return { inset: 0, background: color, clipPath: 'polygon(0 0, 46% 0, 100% 78%, 100% 100%, 58% 100%)' };
    case 'rings': // hypnotic rings, the staple of B-movie title cards
      return { top: '-18%', left: '-22%', width: '130%', aspectRatio: '1', borderRadius: '50%',
        background: `repeating-radial-gradient(circle, ${color} 0 7%, transparent 7% 14%)` };
    case 'stairs': // a staircase climbing out of frame
      return { inset: 0, background: color,
        clipPath: 'polygon(100% 8%, 100% 100%, 0 100%, 0 80%, 20% 80%, 20% 62%, 40% 62%, 40% 44%, 60% 44%, 60% 26%, 80% 26%, 80% 8%)' };
    default: // 'horizon': a small sun over a thin horizon line
      return { inset: 0, background: `radial-gradient(circle at 68% 27%, ${color} 0 14%, transparent 14.4%), linear-gradient(to top, transparent 0 46%, ${color} 46% 47.2%, transparent 47.2%)` };
  }
}

export default function TitleCover({ movie, size = 'full' }) {
  const { palette, composition, flipped, title, titleScale } = coverDesign(movie);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: palette.field, containerType: 'inline-size' }}>
      <div className="absolute" style={{ ...shapeStyle(composition, palette.shape), transform: flipped ? 'scaleX(-1)' : undefined }} />
      <div className="absolute inset-0 mix-blend-multiply opacity-40" style={{ backgroundImage: GRAIN }} />

      {size !== 'thumb' && (
        <div
          className={`absolute inset-x-0 bottom-0 ${size === 'small' ? 'p-2 pt-6' : 'p-3 pt-10'}`}
          style={{ background: `linear-gradient(to top, ${palette.field} 55%, transparent)` }}
        >
          <span
            className="cover-title block"
            style={{ color: palette.ink, fontSize: `${20 * titleScale}cqw`, WebkitLineClamp: size === 'small' ? 4 : 5 }}
          >
            {title}
          </span>
          {movie.year && (
            <span className="block mt-1 text-xs tabular-nums" style={{ color: palette.note }}>
              {movie.year}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
