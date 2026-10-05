import React, { useEffect, useState } from 'react';
import { Check, Lock, Play } from 'lucide-react';
import { DAYS, openedDays, tonight, inOctober, isFinale, ranked, crowdShare, loadSeen, toggleSeen, CROWD_MIN } from '../halloween/days';
import usePosterIndex from '../hooks/usePosterIndex';
import tmdbService from '../services/tmdb';
import { watchUrl, playOnArrival } from '../services/reel';
import { track } from '../services/analytics';
import Button from '../ui/Button';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';

// On a local copy only, ?on=2026-10-31 shows the page as it will be that day
function pageNow() {
  const on = new URLSearchParams(window.location.search).get('on');
  const local = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  return local && /^\d{4}-\d{2}-\d{2}$/.test(on || '') ? new Date(`${on}T12:00:00-07:00`) : new Date();
}

const dateOf = day => `Oct ${day}`;
const posterOf = (entry, size = 'medium') => (entry?.p ? tmdbService.getPosterUrl(entry.p, size) : null);

function SeenToggle({ film, seen, onToggle }) {
  return (
    <button type="button" onClick={() => onToggle(film)} aria-pressed={seen}
      className={`w-full flex items-center justify-center gap-1.5 h-9 rounded-full border text-xs font-mono uppercase tracking-[0.08em] ${seen ? 'bg-bone text-ink border-bone' : 'border-line text-muted hover:text-bone hover:border-bone'}`}>
      <Check className={`w-3.5 h-3.5 ${seen ? '' : 'opacity-40'}`} aria-hidden="true" />Seen it
    </button>
  );
}

function Tonight({ day, entry, seen, onToggle, crowd }) {
  const share = crowdShare(crowd, day.film);
  return (
    <section className="mt-8 grid grid-cols-[120px_1fr] sm:grid-cols-[200px_1fr] gap-5 sm:gap-8 items-start">
      <a href={watchUrl(day.film)} onClick={() => playOnArrival(day.film)} className="film-frame bg-panel" aria-label={`Play ${entry?.t || 'tonight\'s film'}`}>
        {posterOf(entry, 'large') && <img src={posterOf(entry, 'large')} alt="" className="w-full h-full object-cover" />}
      </a>
      <div className="min-w-0">
        <p className="eyebrow">Tonight · {dateOf(day.day)}</p>
        <h2 className="display text-4xl sm:text-6xl text-bone mt-2 break-words">{entry?.t || day.film}</h2>
        {entry?.y && <p className="label mt-2">{entry.y}</p>}
        <p className="text-muted leading-relaxed mt-3 max-w-xl">{day.note}</p>
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <Button href={watchUrl(day.film)} onClick={() => playOnArrival(day.film)} data-track="halloween-play" data-film={day.film}><Play className="w-4 h-4" aria-hidden="true" /> Play</Button>
          <div className="w-32"><SeenToggle film={day.film} seen={seen} onToggle={onToggle} /></div>
        </div>
        {share !== null && <p className="text-sm text-dim mt-3">{share}% have seen it</p>}
      </div>
    </section>
  );
}

function Day({ day, entry, open, today, seen, onToggle, crowd }) {
  if (!open) {
    return (
      <li className="flex flex-col gap-2">
        <div className="film-frame bg-panel flex flex-col items-center justify-center gap-2 text-dim">
          <Lock className="w-5 h-5" aria-hidden="true" />
          <span className="font-mono text-xs uppercase tracking-[0.1em]">{dateOf(day.day)}</span>
        </div>
      </li>
    );
  }
  const share = crowdShare(crowd, day.film);
  return (
    <li className="flex flex-col gap-2">
      <a href={watchUrl(day.film)} className={`film-frame bg-panel ${today ? 'border-signal border-2' : 'hover:border-bone/60'}`}>
        {posterOf(entry) && <img src={posterOf(entry)} alt="" className="w-full h-full object-cover" loading="lazy" />}
        <span className="absolute top-1.5 left-1.5 font-mono text-[10px] uppercase tracking-[0.1em] bg-ink/80 text-bone px-1.5 py-0.5 rounded-sm">{dateOf(day.day)}</span>
      </a>
      <p className="text-sm text-bone leading-snug line-clamp-2">{entry?.t || day.film}</p>
      {share !== null && <p className="text-xs text-dim -mt-1">{share}% have seen it</p>}
      <SeenToggle film={day.film} seen={seen} onToggle={onToggle} />
    </li>
  );
}

function Scoreboard({ index, crowd, onAir }) {
  const order = ranked(crowd?.seen);
  const counted = crowd && crowd.people >= CROWD_MIN;
  const title = day => index?.[day.film]?.t || day.film;
  return (
    <section className="mt-8">
      {onAir && <p className="text-lg text-muted leading-relaxed">All 31 back to back on the Halloween channel, most seen first. <a href="/tv#halloween" className="text-signal underline underline-offset-2 hover:no-underline whitespace-nowrap">Tune in →</a></p>}
      {counted && (
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          {[['Most seen', order[0]], ['The one almost nobody had seen', order.at(-1)]].map(([label, day]) => (
            <a key={label} href={watchUrl(day.film)} className="panel p-4 flex gap-4 items-center hover:border-bone/60">
              <span className="w-16 aspect-[2/3] shrink-0 rounded overflow-hidden bg-ink">{posterOf(index?.[day.film]) && <img src={posterOf(index[day.film])} alt="" className="w-full h-full object-cover" />}</span>
              <span className="min-w-0">
                <span className="eyebrow block">{label}</span>
                <span className="block text-xl font-semibold text-bone mt-1">{title(day)}</span>
                <span className="block text-sm text-dim mt-1">{crowdShare(crowd, day.film)}% have seen it</span>
              </span>
            </a>
          ))}
        </div>
      )}
      {counted && (
        <ol className="mt-8 divide-y divide-line">
          {order.map((day, i) => (
            <li key={day.film}>
              <a href={watchUrl(day.film)} className="flex items-center gap-4 py-2.5 hover:text-bone">
                <span className="font-display font-black text-2xl text-dim tabular-nums w-8 shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0 text-bone truncate">{title(day)}</span>
                <span className="text-sm text-dim tabular-nums shrink-0">{crowdShare(crowd, day.film)}%</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// /halloween: a horror film for every night of October, opened one day at a time
export default function HalloweenPage() {
  const [now] = useState(pageNow);
  const index = usePosterIndex();
  const [seen, setSeen] = useState(() => loadSeen());
  const [crowd, setCrowd] = useState(null);

  useEffect(() => { document.title = '31 Days of Horror | Orphaned Films'; }, []);
  useEffect(() => {
    let live = true;
    fetch('/api/halloween').then(r => (r.ok ? r.json() : null)).then(data => live && data && setCrowd(data)).catch(() => {});
    return () => { live = false; };
  }, []);

  const toggle = film => {
    if (!seen.includes(film)) track('Seen', { film });
    setSeen(toggleSeen(seen, film));
  };
  const opened = openedDays(now);
  const night = tonight(now);
  const finale = isFinale(now);
  const seenOpened = DAYS.slice(0, opened).filter(d => seen.includes(d.film)).length;

  return (
    <div className="min-h-screen">
      <SiteHeader current="/halloween" />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="display text-5xl sm:text-7xl leading-none text-bone">31 Days of Horror</h1>
        <p className="text-lg text-muted leading-relaxed mt-4 max-w-2xl">An 80s horror film for every night of October. A new one opens each day; tick the ones you've seen.</p>
        {opened > 0 && <p className="label mt-4">You've seen {seenOpened} of {opened}</p>}
        {opened === 0 && <p className="text-muted mt-6">The first film opens on October 1.</p>}

        {finale
          ? <Scoreboard index={index} crowd={crowd} onAir={inOctober(now)} />
          : night && <Tonight day={night} entry={index?.[night.film]} seen={seen.includes(night.film)} onToggle={toggle} crowd={crowd} />}

        <h2 className="display text-3xl text-bone mt-12">The calendar</h2>
        <ol className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-x-3 gap-y-5 mt-5">
          {DAYS.map(day => (
            <Day key={day.day} day={day} entry={index?.[day.film]} open={day.day <= opened} today={day === night && !finale}
              seen={seen.includes(day.film)} onToggle={toggle} crowd={crowd} />
          ))}
        </ol>
      </main>
      <SiteFooter />
    </div>
  );
}
