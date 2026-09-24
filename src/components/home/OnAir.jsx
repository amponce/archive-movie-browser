import React, { useEffect, useRef, useState } from 'react';
import { onAirAt } from '../../services/schedule';
import { Sprockets } from '../../ui/FilmCard';
import Button from '../../ui/Button';
import Guide, { useGuideSpan } from '../tv/Guide';
import InlineSet from '../tv/InlineSet';

const PAGE = 6;
const LEAD_MS = 20 * 60_000;
const channelNo = n => `CH ${String(n).padStart(2, '0')}`;
// No moving picture for people who asked for less motion or less data
const stillOnly = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData;

// The picture: the film on air, silent, from the scheduled second. It never has sound (no
// controls, muted set on the element itself, which is what autoplay rules check), pauses while
// the tab is hidden and catches up with the schedule when it comes back. A file the browser
// cannot play leaves the poster showing.
function Picture({ slot }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  const [src] = useState(() => `${slot.film.url}#t=${slot.offset}`); // fixed for this film, or every tick would reload it

  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    const onVisibility = () => {
      if (document.hidden) { video.pause(); return; }
      video.currentTime = (Date.now() - slot.startedAt) / 1000;
      video.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [slot.startedAt]);

  if (failed || !slot.film.url) return null;
  return <video ref={ref} src={src} muted autoPlay playsInline preload="auto" disablePictureInPicture aria-hidden="true" tabIndex={-1} onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" />;
}

// Television on the front page, laid out like the old Prevue channel: the selected channel playing
// over the guide grid, six channels at a time. Choosing a row plays it right under the row, with
// sound; Tune in opens the set.
// `skip`: channel ids not to open on (the lists the page already shows as shelves).
export default function OnAir({ skip = [] } = {}) {
  const [channels, setChannels] = useState(null);
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(null); // the guide row playing under itself
  const [now, setNow] = useState(Date.now);
  const screenRef = useRef(null);
  const span = useGuideSpan();

  useEffect(() => {
    fetch('/api/tv').then(r => (r.ok ? r.json() : { channels: [] })).then(({ channels: all }) => {
      const on = all.filter(c => onAirAt(c.lineup));
      const first = Math.max(0, on.findIndex(c => !skip.includes(c.id)));
      setChannels(on);
      setSelected(first);
      setPage(Math.floor(first / PAGE));
    }).catch(() => setChannels([]));
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  // Only stream while the picture itself is on screen (the section is taller than a screen)
  useEffect(() => {
    const el = screenRef.current;
    if (!el || stillOnly()) return undefined;
    const seen = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    seen.observe(el);
    return () => seen.disconnect();
  }, [channels]);

  if (!channels?.length) return null;
  const channel = channels[selected];
  const slot = onAirAt(channel.lineup, now);
  const { film, offset } = slot;
  const minutesIn = Math.floor(offset / 60);
  const progress = Math.min(100, (offset / film.seconds) * 100);
  const tuneHref = `/tv#${channel.id}`;
  const pages = Math.ceil(channels.length / PAGE);
  const first = page * PAGE;
  const shown = channels.slice(first, first + PAGE);
  const turn = step => setPage(p => (p + step + pages) % pages);

  return (
    <section id="on-air" aria-labelledby="on-air-channel" className="rule">
      <p className="sr-only" aria-live="polite">{`Previewing channel ${channel.number}, ${channel.name}: ${film.title}, ${minutesIn} minutes in.`}</p>
      <div className="gutter pt-10 lg:pt-12 pb-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end">
        <div className="lg:col-span-6 flex flex-col gap-6 order-2 lg:order-1">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            <span className="eyebrow"><span className="inline-block w-2 h-2 rounded-full bg-signal mr-2 align-middle animate-pulse motion-reduce:animate-none" aria-hidden="true" />On air</span>
            <span className="label">{channels.length} channels · the same for everyone</span>
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-display font-black text-signal text-3xl tabular-nums">{channelNo(channel.number)}</span>
            <h2 id="on-air-channel" className="font-display font-black uppercase leading-[0.9] text-[40px] sm:text-[56px] lg:text-[64px]">{channel.name}</h2>
            <p className="text-lg text-muted leading-relaxed max-w-[560px] line-clamp-3">
              <span className="text-bone">{film.title}{film.year ? ` (${film.year})` : ''}, {minutesIn} min in.</span> {channel.blurb}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button href={tuneHref} size="lg" data-track="home-tune-in"><span className="inline-block w-2 h-2 rounded-full bg-ink" aria-hidden="true" /> Tune in</Button>
            <Button href="/tv#mine" variant="ghost" size="lg" data-track="home-start-channel">Start your own channel</Button>
          </div>
        </div>

        <a ref={screenRef} href={tuneHref} data-track="home-tv-picture" aria-label={`Tune in to ${channel.name}, now showing ${film.title}`} className="lg:col-span-6 order-1 lg:order-2 relative block aspect-video rounded-lg overflow-hidden border border-white/[0.06] bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
          {film.poster && <img src={film.poster.replace('/w342/', '/w780/')} alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_25%] opacity-60" />}
          {visible && <Picture key={`${channel.id}:${film.id}`} slot={slot} />}
          <span className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-ink/40" />
          <Sprockets />
          <span className="absolute top-4 sm:top-5 left-7 sm:left-8 right-7 sm:right-8 flex justify-between items-start gap-3">
            <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-bone/90 truncate">{channelNo(channel.number)} · {channel.name}</span>
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink bg-signal px-2 py-1 rounded-sm shrink-0">Live</span>
          </span>
          <span className="absolute bottom-4 sm:bottom-5 left-7 sm:left-8 right-7 sm:right-8 flex items-center gap-3">
            <span className="flex-1 h-1 rounded-full bg-bone/20 overflow-hidden"><span className="block h-full bg-signal" style={{ width: `${progress}%` }} /></span>
            <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-bone/80 tabular-nums">{minutesIn} / {Math.round(film.seconds / 60)} min</span>
          </span>
        </a>
      </div>

      <div className="gutter pb-10">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-3">
          <p className="text-muted">Channels {first + 1} to {first + shown.length} of {channels.length}, {span.label}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => turn(-1)} className="btn-ghost" data-track="home-channel-up">Channel up</button>
            <button type="button" onClick={() => turn(1)} className="btn-ghost" data-track="home-channel-down">Channel down</button>
            <a href="/tv" data-track="home-full-guide" className="nav-link px-2 whitespace-nowrap hover:text-signal">Full guide</a>
          </div>
        </div>
        <div className="rounded-lg border border-line px-2">
          <Guide channels={shown} current={channel} now={now} hours={span.hours} lead={LEAD_MS}
            onTune={c => { setSelected(channels.indexOf(c)); setOpen(o => (o === c.id ? null : c.id)); }}
            open={open} renderOpen={c => <InlineSet channel={c} onClose={() => setOpen(null)} />} />
        </div>
      </div>
    </section>
  );
}
