import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAirAt, tuneIn } from '../services/schedule';
import { shortcutFor } from '../services/playback';
import { track } from '../services/analytics';
import useMyChannel from '../hooks/useMyChannel';
import { shareUrl } from '../services/myChannel';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';

// Television. Every channel is a list playing in order from a fixed moment, so what is on is
// the same for everyone. The page keeps its own clock: /api/tv gives the lineups once, and the
// schedule maths (services/schedule) says what is on now, so nothing is refetched when a film ends.

const GUIDE_HOURS = 3;
const LAST_CHANNEL_KEY = 'tv-last-channel';
const readLast = () => { try { return localStorage.getItem(LAST_CHANNEL_KEY); } catch { return null; } };
const rememberLast = id => { try { localStorage.setItem(LAST_CHANNEL_KEY, id); } catch { /* private mode */ } };
const clock = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const mins = s => `${Math.floor(s / 60)} min`;

function useSchedule() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch('/api/tv').then(r => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))).then(setData).catch(e => setError(e.message));
  }, []);
  return { channels: data?.channels || [], error };
}

// What the set is doing: which film, from where, and the video element playing it. Re-tunes when
// the channel changes, moves to the next film on its own, and takes the player shortcuts.
function useTuning(channel, onNext) {
  const videoRef = useRef(null);
  const [slot, setSlot] = useState(() => onAirAt(channel.lineup));
  const [fromStart, setFromStart] = useState(false);
  const [needsClick, setNeedsClick] = useState(false);

  useEffect(() => { setSlot(onAirAt(channel.lineup)); setFromStart(false); }, [channel.id]);

  const start = fromStart ? { film: slot?.film, offset: 0 } : tuneIn(slot);
  const film = start?.film || slot?.film;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !film) return;
    video.currentTime = start?.offset || 0;
    video.play().then(() => setNeedsClick(false)).catch(() => setNeedsClick(true)); // autoplay may need a gesture
  }, [film?.id, fromStart]);

  const next = useCallback(() => {
    // The film ended: the schedule has moved on to the next one by now
    const now = onAirAt(channel.lineup);
    setFromStart(false);
    setSlot(now && now.film.id === film?.id ? { ...now, film: channel.lineup[(now.index + 1) % channel.lineup.length], offset: 0 } : now);
    onNext?.();
  }, [channel, film?.id, onNext]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const action = shortcutFor(event);
      const video = videoRef.current;
      if (!action || !video) return;
      event.preventDefault();
      if (action.seek) video.currentTime = Math.min(Math.max(0, video.currentTime + action.seek), video.duration || Infinity);
      if (action.toggle) video.paused ? video.play() : video.pause();
      if (action.fullscreen) video.requestFullscreen?.();
      if (action.mute) video.muted = !video.muted;
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const play = () => videoRef.current?.play().then(() => setNeedsClick(false));
  return { film, slot, start, fromStart, restart: () => setFromStart(true), needsClick, play, videoRef, next };
}

function Screen({ tuning }) {
  const { film, needsClick, play, videoRef, next } = tuning;
  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
      {film ? <video ref={videoRef} key={film.id} src={film.url} controls playsInline className="absolute inset-0 w-full h-full" onEnded={next} onError={next} />
        : <div className="absolute inset-0 flex items-center justify-center text-muted">Nothing on this channel yet.</div>}
      {film && needsClick && (
        <button type="button" onClick={play} className="absolute inset-0 flex items-center justify-center bg-ink/60">
          <span className="btn-primary btn-lg">Tune in</span>
        </button>
      )}
    </div>
  );
}

// One line under the screen: what this is, and the two things you can do about it
function NowPlaying({ channel, tuning }) {
  const { film, slot, start, fromStart, restart } = tuning;
  if (!film) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 border-b border-line">
      <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display font-black text-xl text-signal tabular-nums shrink-0">{channel.number}</span>
        <span className="display text-lg text-bone truncate">{film.title}{film.year ? <span className="text-dim font-sans font-normal normal-case text-sm"> {film.year}</span> : null}</span>
        {slot && <span className="label">{clock(slot.startedAt)} – {clock(slot.endsAt)}{!fromStart && start?.offset ? ` · joined ${mins(start.offset)} in` : ''}</span>}
      </div>
      <div className="flex items-center gap-4">
        {!fromStart && start?.offset > 0 && <button type="button" onClick={() => { track('TV', { action: 'from start', channel: channel.id }); restart(); }} className="nav-link hover:text-signal">From the start</button>}
        <a href={`/browse#${encodeURIComponent(film.id)}`} className="nav-link">Film page</a>
      </div>
    </div>
  );
}

// Beside the set: every channel and what it is showing, so nobody has to scroll to learn there
// are more. Tap to tune.
// The stage: the screen with the channels beside it (ending where the screen ends), and the
// now-playing line under the screen
function Stage({ channel, channels, onTune, onNext }) {
  const tuning = useTuning(channel, onNext);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-4">
      <div className="lg:col-span-8"><Screen tuning={tuning} /></div>
      <aside className="lg:col-span-4 relative flex flex-col gap-3" aria-label="Channels">
        <span className="label lg:hidden">Channels</span>
        <Rail channels={channels} current={channel} onTune={onTune} />
      </aside>
      <div className="lg:col-span-8"><NowPlaying channel={channel} tuning={tuning} /></div>
    </div>
  );
}

function Rail({ channels, current, onTune }) {
  return (
    <ol className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:absolute lg:inset-0 pb-1 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0 lg:pr-1">
      {channels.map(channel => {
        const on = channel.now?.film;
        const isCurrent = channel.id === current?.id;
        return (
          <li key={channel.id} className="shrink-0 w-[220px] lg:w-auto">
            <button type="button" onClick={() => onTune(channel)} aria-current={isCurrent ? 'true' : undefined}
              className={`w-full flex items-center gap-3 p-2 rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:border-signal ${isCurrent ? 'border-signal bg-panel' : 'border-line hover:border-bone'}`}>
              <span className="relative w-10 aspect-[2/3] shrink-0 rounded-sm overflow-hidden bg-line">
                {on?.poster && <img src={on.poster} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={`font-display font-black text-lg tabular-nums ${isCurrent ? 'text-signal' : 'text-dim'}`}>{channel.number}</span>
                  <span className="text-sm font-medium text-bone truncate">{channel.name}</span>
                </span>
                <span className="block label truncate">{on ? `Now: ${on.title}` : 'Off air'}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// The guide: one row per channel, the next hours across, a line where now is
function Guide({ channels, current, now, onTune }) {
  const from = now;
  const to = now + GUIDE_HOURS * 3600_000;
  const span = to - from;
  const left = ms => `${Math.max(0, ((ms - from) / span) * 100)}%`;
  const width = (a, b) => `${((Math.min(b, to) - Math.max(a, from)) / span) * 100}%`;
  const ticks = Array.from({ length: GUIDE_HOURS * 2 + 1 }, (_, i) => from + i * 1800_000);

  return (
    <div className="flex flex-col">
      <div className="hidden sm:grid grid-cols-[200px_1fr] gap-4 mb-2">
        <span />
        <div className="relative h-5">
          {ticks.map(t => <span key={t} className="absolute label -translate-x-1/2" style={{ left: left(t) }}>{clock(t)}</span>)}
        </div>
      </div>
      {channels.map(channel => (
        <button key={channel.id} type="button" onClick={() => onTune(channel)} aria-current={channel.id === current?.id ? 'true' : undefined}
          className={`group grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 sm:gap-4 py-3 border-t border-line text-left focus-visible:outline-none ${channel.id === current?.id ? 'bg-panel/60' : 'hover:bg-panel/40'}`}>
          <span className="flex items-baseline gap-3 px-2 min-w-0">
            <span className="font-display font-black text-2xl tabular-nums text-dim group-aria-[current]:text-signal">{channel.number}</span>
            <span className="font-medium text-sm text-bone truncate">{channel.name}</span>
          </span>
          <span className="relative h-14 overflow-hidden">
            {channel.programmes.map(p => (
              <span key={`${p.id}-${p.startsAt}`} className="absolute top-0 bottom-0 flex flex-col justify-center px-3 rounded-md bg-panel border border-line overflow-hidden" style={{ left: left(p.startsAt), width: width(p.startsAt, p.endsAt) }}>
                <span className="text-sm text-bone truncate">{p.title}</span>
                <span className="label truncate">{clock(p.startsAt)} – {clock(p.endsAt)}</span>
              </span>
            ))}
            <span aria-hidden="true" className="absolute top-0 bottom-0 w-px bg-signal" style={{ left: left(now) }} />
          </span>
        </button>
      ))}
    </div>
  );
}

export default function TvPage() {
  const { channels: stations, error } = useSchedule();
  const mine = useMyChannel();
  // The personal channel goes first, as channel 0, when it has anything on it
  const channels = useMemo(() => (mine && mine.lineup.length ? [mine, ...stations] : stations), [mine, stations]);
  // The channel in the link, else the one this browser watched last, else channel 1
  const [currentId, setCurrentId] = useState(() => decodeURIComponent(window.location.hash.slice(1)) || readLast());
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { document.title = 'TV | Orphaned Films'; }, []);

  const current = useMemo(() => channels.find(c => c.id === currentId) || (mine?.lineup.length && window.location.search.includes('mine=') ? mine : null) || channels[0] || null, [channels, currentId, mine]);
  const tune = useCallback((channel) => {
    setCurrentId(channel.id);
    rememberLast(channel.id);
    window.history.replaceState({}, '', `/tv#${channel.id}`);
    track('TV', { action: 'tune', channel: channel.id });
  }, []);

  // Channel up and down
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!channels.length || ['INPUT', 'TEXTAREA'].includes(event.target?.tagName)) return;
      const i = channels.findIndex(c => c.id === current?.id);
      if (event.key === 'ArrowUp') { event.preventDefault(); tune(channels[(i - 1 + channels.length) % channels.length]); }
      if (event.key === 'ArrowDown') { event.preventDefault(); tune(channels[(i + 1) % channels.length]); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [channels, current, tune]);

  return (
    <div className="min-h-screen">
      <SiteHeader current="/tv" />
      <main className="gutter py-8 flex flex-col gap-8">
        {error && <p className="text-muted">The guide didn't load ({error}). <a href="/browse" className="text-bone underline">Browse instead.</a></p>}
        {current && <Stage channel={current} channels={channels} onTune={tune} onNext={() => setNow(Date.now())} />}
        {mine && (mine.lineup.length > 0 || mine.pending > 0) && (
          <p className="label flex flex-wrap items-center gap-x-4 gap-y-1 -mt-4">
            <span>{mine.mine ? 'Your channel' : 'This shared channel'} has {mine.ids.length} film{mine.ids.length === 1 ? '' : 's'}{mine.pending ? `, measuring ${mine.pending}` : ''}. {mine.mine ? 'Add more from any film page.' : ''}</span>
            {mine.mine && mine.lineup.length > 0 && <button type="button" className="nav-link hover:text-signal" onClick={() => { navigator.clipboard?.writeText(shareUrl(mine.ids, window.location.origin)); track('TV', { action: 'share my channel' }); }}>Copy a link to it</button>}
            {mine.lineup.length > 0 && <a href={`/api/tv?format=m3u&mine=${mine.ids.map(encodeURIComponent).join(',')}`} className="nav-link hover:text-signal">M3U for your player</a>}
          </p>
        )}
        {channels.length > 0 && (
          <section className="flex flex-col gap-5 pt-4 border-t border-line">
            <div className="flex items-end justify-between gap-6">
              <div>
                <span className="eyebrow">Guide</span>
                <h2 className="display text-2xl mt-1">The next three hours</h2>
              </div>
              <a href="/api/tv/playlist.m3u" className="nav-link shrink-0 hover:text-signal">M3U for your player →</a>
            </div>
            <Guide channels={channels} current={current} now={now} onTune={tune} />
          </section>
        )}
      </main>
      <SiteFooter><a href="/api/tv/guide.xml" className="label hover:text-bone">XMLTV guide</a></SiteFooter>
    </div>
  );
}
