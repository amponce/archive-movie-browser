import React, { useEffect, useState } from 'react';
import archiveService from '../../services/archive';
import tmdbService from '../../services/tmdb';
import { changesIn } from '../../services/programme';
import { watchUrl } from '../../services/reel';
import { Sprockets } from '../../ui/FilmCard';
import Button from '../../ui/Button';
import PosterWall from './PosterWall';

const PlayIcon = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg>;

// Tonight's film. `featured` is { id, entry, why } from the programme; the film's own
// Archive.org record fills in director and runtime once it arrives.
export default function Hero({ featured, fileNumber, wall }) {
  const [film, setFilm] = useState(null);
  useEffect(() => {
    setFilm(null);
    archiveService.getMovieByIdentifier(featured.id).then(setFilm).catch(() => {});
  }, [featured.id]);

  const { entry, why } = featured;
  const meta = [entry.y, film?.creator, film?.runtimeMinutes > 0 && archiveService.formatRuntime(film.runtimeMinutes), film?.genres?.find(g => g !== 'Uncategorized')]
    .filter(Boolean).join(' · ');
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const href = watchUrl(featured.id);

  return (
    <section id="tonight" className="relative rule">
      <PosterWall films={wall} />
      <div className="relative gutter grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 py-10 lg:py-14 items-center">
        <div className="lg:col-span-7 flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
              <span className="eyebrow"><span className="inline-block w-2 h-2 rounded-full bg-signal mr-2 align-middle" />Tonight's orphan</span>
              <span className="label">{today} · changes in {changesIn()}</span>
            </div>
            <h1 className="font-display font-black uppercase leading-[0.86] tracking-[0.005em] text-[56px] sm:text-[88px] lg:text-[112px]">{entry.t}</h1>
            <p className="text-lg text-muted leading-relaxed max-w-[560px]">
              {meta && <span className="text-bone">{meta}. </span>}{why}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button href={href} size="lg"><PlayIcon /> Watch now</Button>
            <span className="font-mono text-xs tracking-[0.1em] uppercase text-muted">Hosted by the <span className="text-bone">Internet Archive</span></span>
          </div>
        </div>

        <a href={href} aria-label={`Watch ${entry.t}`} className="lg:col-span-5 relative block aspect-square w-full rounded-lg overflow-hidden border border-white/[0.06] bg-[#3A1420] group">
          <img src={tmdbService.getPosterUrl(entry.p, 'large')} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-ink/40" />
          <Sprockets />
          <span className="absolute top-5 left-8 right-8 flex justify-between items-start">
            <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-bone/80">Orphan file № {fileNumber}</span>
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink bg-bone px-2 py-1 rounded-sm">Internet Archive</span>
          </span>
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[88px] h-[88px] rounded-full bg-signal text-ink flex items-center justify-center group-hover:scale-105 transition-transform">
            <PlayIcon size={34} />
          </span>
          <span className="absolute bottom-5 left-8 right-8 flex justify-between font-mono text-xs tracking-[0.12em] uppercase text-bone/80">
            <span>{[entry.y, film?.runtimeMinutes > 0 && `${Math.round(film.runtimeMinutes)} min`].filter(Boolean).join(' · ')}</span>
            {entry.v > 0 && <span>{entry.v.toFixed(1)} on TMDB</span>}
          </span>
        </a>
      </div>
    </section>
  );
}
