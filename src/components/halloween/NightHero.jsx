import React from 'react';
import { Play, Clock } from 'lucide-react';
import { Sprockets } from '../../ui/FilmCard';
import Button from '../../ui/Button';
import { watchUrl, playOnArrival } from '../../services/reel';
import { untilText } from '../../halloween/days';
import { posterOf, titleOf, factsOf, SeenButton } from './parts';

// Tonight's film as the lobby card: the night's number, the film, its note, play, seen, and when
// the next night opens. Before October there is no film yet, only the wait.
export default function NightHero({ day, entry, seen, onToggle, next, now }) {
  const poster = posterOf(entry, 'large');
  const countdown = next && (
    <p className="flex items-center gap-2 font-mono text-xs tracking-[0.12em] uppercase text-muted">
      <Clock className="w-3.5 h-3.5 text-signal" aria-hidden="true" />
      {next.night === 31 ? 'The last night' : `Night ${next.night}`} opens in <span className="text-bone tabular-nums">{untilText(next.at - now)}</span>
    </p>
  );

  return (
    <section className="relative overflow-hidden rule">
      {poster && <img src={poster} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-70 md:opacity-40 lg:opacity-30" />}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/75 to-ink/30 md:bg-gradient-to-r md:from-ink md:via-ink/90 md:to-ink/40" aria-hidden="true" />
      <div className="relative gutter grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] lg:grid-cols-[minmax(0,1fr)_380px] gap-8 lg:gap-12 py-10 sm:py-14 lg:py-16 items-center">
        <div className="flex flex-col gap-6">
          <h1 className="eyebrow flex items-center"><span className="inline-block w-2 h-2 rounded-full bg-signal mr-2" aria-hidden="true" />31 Days of Horror</h1>
          {day ? (
            <>
              <div>
                <p className="font-display font-black uppercase leading-[0.8] text-[88px] sm:text-[120px] lg:text-[168px] text-bone">
                  Night <span className="text-signal flicker">{day.day}</span>
                </p>
                <div className="mt-5 flex items-end gap-4">
                  {poster && <img src={posterOf(entry)} alt="" className="md:hidden w-24 aspect-[2/3] object-cover rounded-md border border-white/[0.08] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] shrink-0" />}
                  <div className="min-w-0">
                    <h2 className="font-display font-black uppercase leading-[0.9] text-4xl sm:text-5xl text-bone break-words">{titleOf(entry, day)}</h2>
                    <p className="label mt-3">{factsOf(entry, day)}</p>
                  </div>
                </div>
              </div>
              <p className="text-lg text-muted leading-relaxed max-w-xl">{day.note}</p>
              <div className="flex items-center gap-3">
                <Button href={watchUrl(day.film)} onClick={() => playOnArrival(day.film)} size="lg" className="flex-1 sm:flex-none" data-track="halloween-play" data-film={day.film}>
                  <Play className="w-4 h-4" fill="currentColor" aria-hidden="true" /> <span>Play tonight<span className="hidden sm:inline">'s film</span></span>
                </Button>
                <SeenButton seen={seen} onClick={() => onToggle(day.film)} large />
              </div>
              {countdown}
            </>
          ) : (
            <>
              <p className="font-display font-black uppercase leading-[0.8] text-[88px] sm:text-[120px] lg:text-[168px] text-bone">
                Night <span className="text-signal flicker">1</span>
              </p>
              <p className="text-lg text-muted leading-relaxed max-w-xl">An 80s horror film for every night of October. A new one opens each day; tick the ones you've seen.</p>
              {countdown}
            </>
          )}
        </div>
        {day && (
          <a href={watchUrl(day.film)} onClick={() => playOnArrival(day.film)} tabIndex={-1} aria-hidden="true"
            className="hidden md:block relative w-full aspect-[2/3] rounded-lg overflow-hidden border border-white/[0.08] bg-panel shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
            {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            <Sprockets />
          </a>
        )}
      </div>
    </section>
  );
}
