import React, { useEffect, useState } from 'react';
import { DAYS, openedDays, tonight, inOctober, isFinale, nextOpening, crowdShare, loadSeen, toggleSeen } from '../halloween/days';
import usePosterIndex from '../hooks/usePosterIndex';
import { track } from '../services/analytics';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import NightHero from '../components/halloween/NightHero';
import Shelf from '../components/halloween/Shelf';
import NightSheet from '../components/halloween/NightSheet';
import { FinaleHero, Ranking } from '../components/halloween/Finale';

// On a local copy only, ?on=2026-10-31 shows the page as it will be that day (and holds the clock)
function preview() {
  const on = new URLSearchParams(window.location.search).get('on');
  const local = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  return local && /^\d{4}-\d{2}-\d{2}$/.test(on || '') ? Date.parse(`${on}T12:00:00-07:00`) : null;
}

// The clock, every 30 seconds: the countdown moves and a night opens at midnight without a reload
function useNow() {
  const [fixed] = useState(preview);
  const [now, setNow] = useState(() => fixed ?? Date.now());
  useEffect(() => {
    if (fixed) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, [fixed]);
  return now;
}

// Your month as 31 cells: seen, open, still to come
function Progress({ seen, opened }) {
  const count = DAYS.filter(d => seen.includes(d.film)).length;
  return (
    <section className="gutter py-8 rule flex flex-col gap-4" aria-label="Your progress">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="font-mono text-xs tracking-[0.12em] uppercase text-bone">You've seen <span className="text-signal tabular-nums">{count}</span> of 31</p>
        <p className="label">{opened} of 31 open</p>
      </div>
      <div className="flex gap-[3px]" aria-hidden="true">
        {DAYS.map(d => (
          <span key={d.day} className={`h-2.5 flex-1 rounded-[1px] ${seen.includes(d.film) ? 'bg-signal' : d.day <= opened ? 'border border-bone/40' : 'bg-line/70'}`} />
        ))}
      </div>
    </section>
  );
}

// /halloween: a horror film for every night of October, opened one night at a time
export default function HalloweenPage() {
  const now = useNow();
  const index = usePosterIndex();
  const [seen, setSeen] = useState(() => loadSeen());
  const [crowd, setCrowd] = useState(null);
  const [open, setOpen] = useState(null); // the night whose card is up

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
  const date = new Date(now);
  const opened = openedDays(date);
  const night = tonight(date);

  return (
    <div className="min-h-screen">
      <SiteHeader current="/halloween" />
      <main>
        {isFinale(date)
          ? <FinaleHero index={index} crowd={crowd} onAir={inOctober(date)} />
          : <NightHero day={night} entry={night && index?.[night.film]} seen={!!night && seen.includes(night.film)} onToggle={toggle} next={nextOpening(date)} now={now} />}
        <Progress seen={seen} opened={opened} />
        {isFinale(date) && <Ranking index={index} crowd={crowd} />}
        <section className="gutter pt-12 pb-16" aria-labelledby="shelf-title">
          <h2 id="shelf-title" className="display text-3xl sm:text-4xl text-bone">The shelf</h2>
          {opened > 0 && <p className="text-muted leading-relaxed mt-2 max-w-2xl text-balance">An 80s horror film for every night of October.{isFinale(date) ? ' Tick the ones you\'ve seen.' : ' A new one opens each day; tick the ones you\'ve seen.'}</p>}
          <div className="mt-4">
            <Shelf index={index} opened={opened} tonightDay={isFinale(date) ? null : night?.day} seen={seen} onOpen={(day, opener) => setOpen({ day, opener })} />
          </div>
        </section>
      </main>
      {open && (
        <NightSheet day={open.day} opener={open.opener} entry={index?.[open.day.film]} tonight={open.day === night && !isFinale(date)} seen={seen.includes(open.day.film)}
          onToggle={toggle} share={crowdShare(crowd, open.day.film)} onClose={() => setOpen(null)} />
      )}
      <SiteFooter />
    </div>
  );
}
