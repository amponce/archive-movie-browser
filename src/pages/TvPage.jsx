import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAirAt, tuneIn } from '../services/schedule';
import { shortcutFor } from '../services/playback';
import { track } from '../services/analytics';
import useMyChannel from '../hooks/useMyChannel';
import useWatchReport from '../hooks/useWatchReport';
import PopOut from '../ui/PopOut';
import useSubtitles, { SubtitleTracks, subtitleNote } from '../hooks/useSubtitles';
import { shareUrl } from '../services/myChannel';
import { watchUrl } from '../services/reel';
import Section, { CardGrid } from '../ui/Section';
import FilmCard from '../ui/FilmCard';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import Guide, { useGuideSpan } from '../components/tv/Guide';
import InlineSet from '../components/tv/InlineSet';
import { WatchTogether, EmptyChannel } from '../components/tv/Extras';

// Television. Every channel is a list playing in order from a fixed moment, so what is on is
// the same for everyone. The page keeps its own clock: /api/tv gives the lineups once, and the
// schedule maths (services/schedule) says what is on now, so nothing is refetched when a film ends.

const LAST_CHANNEL_KEY = 'tv-last-channel';
const readLast = () => { try { return localStorage.getItem(LAST_CHANNEL_KEY); } catch { return null; } };
const rememberLast = id => { try { localStorage.setItem(LAST_CHANNEL_KEY, id); } catch { /* private mode */ } };
const clock = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

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
  return { film, slot, start, fromStart, restart: () => setFromStart(true), live: () => setFromStart(false), needsClick, play, videoRef, next };
}

// Ten minutes of actual playback on one channel counts as someone staying, once per tune-in
// Every second played also goes to the minutes-watched report for this channel
function useStayed(channelId) {
  const played = useRef({ seconds: 0, last: null, sent: false });
  const minutes = useWatchReport('tv', { channel: channelId }, channelId);
  useEffect(() => { played.current = { seconds: 0, last: null, sent: false }; }, [channelId]);
  return (event) => {
    const p = played.current;
    const t = event.currentTarget.currentTime;
    if (event.type === 'pause') { minutes.current.flush(); return; }
    if (p.last !== null && t > p.last && t - p.last < 2) { p.seconds += t - p.last; minutes.current.add(t - p.last); } // skip seeks
    p.last = t;
    if (!p.sent && p.seconds >= 600) { p.sent = true; track('TV', { action: 'watched 10 minutes', channel: channelId }); }
  };
}

function Screen({ tuning, channelId, subtitles }) {
  const { film, needsClick, play, videoRef, next } = tuning;
  const onTimeUpdate = useStayed(channelId);
  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
      {film ? <video ref={videoRef} src={film.url} controls playsInline className="absolute inset-0 w-full h-full" onEnded={next} onError={next} onTimeUpdate={onTimeUpdate} onPause={onTimeUpdate}>
          <SubtitleTracks identifier={film.id} tracks={subtitles} />
        </video>
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
function NowPlaying({ channel, tuning, subtitles }) {
  const { film, slot, start, fromStart, restart, live, videoRef } = tuning;
  if (!film) return null;
  const joined = !fromStart && start?.offset > 60 ? Math.floor(start.offset / 60) : 0;
  const facts = [
    slot && `On until ${clock(slot.endsAt)}`,
    fromStart ? 'watching from the beginning' : joined ? `you joined ${joined} minutes in` : null,
    film.rating > 0 && `TMDB ${film.rating.toFixed(1)}`,
    film.critics != null && `Critics ${film.critics}%`,
    subtitleNote(subtitles),
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-4 py-4 border-b border-line">
      <div className="min-w-0 flex flex-col gap-1">
        <p className="flex items-baseline gap-3 min-w-0">
          <span className="font-display font-black text-2xl text-signal tabular-nums shrink-0">{channel.number}</span>
          <span className="display text-2xl text-bone truncate">{film.title}</span>
          {film.year && <span className="text-dim shrink-0">{film.year}</span>}
        </p>
        <p className="text-sm text-muted">{facts.join(' · ')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {joined > 0 && <button type="button" onClick={() => { track('TV', { action: 'from start', channel: channel.id }); restart(); }} className="btn-ghost">Start from the beginning</button>}
        {fromStart && <button type="button" onClick={live} className="btn-ghost">Back to live</button>}
        <PopOut video={() => videoRef.current} />
        <a href={`/browse#${encodeURIComponent(film.id)}`} className="btn-ghost">About this film</a>
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
  const subtitles = useSubtitles(tuning.film?.id, tuning.film?.url);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-4">
      <div className="lg:col-span-8"><Screen tuning={tuning} channelId={channel.id} subtitles={subtitles} /></div>
      <aside className="lg:col-span-4 flex flex-col gap-3" aria-label="Channels">
        <span className="label lg:hidden">Channels</span>
        <div className="relative lg:flex-1"><Rail channels={channels} current={channel} onTune={onTune} /></div>
        <WatchTogether channel={channel} />
      </aside>
      <div className="lg:col-span-8"><NowPlaying channel={channel} tuning={tuning} subtitles={subtitles} /></div>
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

export default function TvPage() {
  const { channels: stations, error } = useSchedule();
  const mine = useMyChannel();
  const span = useGuideSpan();
  const [open, setOpen] = useState(null); // the guide row playing under itself
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
        {currentId === 'mine' && !mine?.ids.length && <EmptyChannel />}
        {current && <Stage channel={current} channels={channels} onTune={tune} onNext={() => setNow(Date.now())} />}
        {mine && (mine.lineup.length > 0 || mine.pending > 0) && (
          <p className="label flex flex-wrap items-center gap-x-4 gap-y-1 -mt-4">
            <span>{mine.mine ? 'Your channel' : 'This shared channel'} has {mine.ids.length} film{mine.ids.length === 1 ? '' : 's'}{mine.pending ? `, measuring ${mine.pending}` : ''}. {mine.mine ? 'Add more from any film page.' : ''}</span>
            {mine.mine && mine.lineup.length > 0 && <button type="button" className="nav-link hover:text-signal" onClick={() => { navigator.clipboard?.writeText(shareUrl(mine.ids, window.location.origin)); track('TV', { action: 'share my channel' }); }}>Copy a link to it</button>}
            {mine.lineup.length > 0 && <a href={`/api/tv?format=m3u&mine=${mine.ids.map(encodeURIComponent).join(',')}`} className="nav-link hover:text-signal">M3U for your player</a>}
          </p>
        )}
        {mine?.mine && mine.lineup.length > 0 && (
          <Section id="my-lineup" eyebrow="Your channel" title="The lineup" blurb="Plays in this order, round the clock. Take a film off here, add more from any film page.">
            <CardGrid>
              {mine.lineup.map(film => (
                <FilmCard key={film.id} film={{ id: film.id, title: film.title, year: film.year, poster: film.poster }} href={watchUrl(film.id)} onRemove={mine.remove} />
              ))}
            </CardGrid>
          </Section>
        )}
        {channels.length > 0 && (
          <section className="flex flex-col gap-5 pt-4 border-t border-line">
            <div className="flex items-end justify-between gap-6">
              <div>
                <span className="eyebrow">Guide</span>
                <h2 className="display text-2xl mt-1">{span.label[0].toUpperCase() + span.label.slice(1)}</h2>
              </div>
              <a href="/api/tv/playlist.m3u" className="nav-link shrink-0 hover:text-signal">M3U for your player →</a>
            </div>
            <Guide channels={channels} current={current} now={now} hours={span.hours} onTune={c => setOpen(o => (o === c.id ? null : c.id))}
              open={open} renderOpen={c => <InlineSet channel={c} onClose={() => setOpen(null)} />} />
          </section>
        )}
      </main>
      <SiteFooter><a href="/api/tv/guide.xml" className="label hover:text-bone inline-flex items-center min-h-[44px]">XMLTV guide</a></SiteFooter>
    </div>
  );
}
