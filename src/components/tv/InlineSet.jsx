import React, { useEffect, useRef, useState } from 'react';
import { onAirAt } from '../../services/schedule';
import { track } from '../../services/analytics';
import useWatchReport from '../../hooks/useWatchReport';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const minutes = s => Math.floor(s / 60);

// A channel playing right where it was picked in the guide: the film on air, from the scheduled
// second, with sound (the pick is the gesture that allows it). When a phone still refuses, a
// Tap to play button covers the picture, so it is never unclear whether it will start. Moves on
// to the next film by itself, like the set does.
export default function InlineSet({ channel, onClose }) {
  const box = useRef(null);
  const video = useRef(null);
  const [slot, setSlot] = useState(() => onAirAt(channel.lineup));
  const [blocked, setBlocked] = useState(false);
  const [tuning, setTuning] = useState(true); // Archive.org can take seconds to start streaming
  const report = useWatchReport('tv', { channel: channel.id }, channel.id);
  const last = useRef(null);

  useEffect(() => {
    track('TV', { action: 'tune', channel: channel.id });
    box.current?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [channel.id]);

  useEffect(() => {
    const v = video.current;
    if (!v || !slot) return;
    v.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }, [slot?.film.id]);

  if (!slot) return null;
  const { film } = slot;
  const next = () => { report.current.flush(); setTuning(true); setSlot(onAirAt(channel.lineup, slot.endsAt + 1000)); };
  const played = (e) => {
    const t = e.currentTarget.currentTime;
    if (last.current !== null && t > last.current && t - last.current < 2) report.current.add(t - last.current);
    last.current = t;
  };

  return (
    <div ref={box} className="flex flex-col gap-3 px-2 w-full max-w-[calc(70vh*16/9)]">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video ref={video} key={film.id} src={`${film.url}#t=${slot.offset}`} controls playsInline className="absolute inset-0 w-full h-full" poster={film.poster || undefined}
          onPlaying={() => setTuning(false)} onWaiting={() => setTuning(true)} onEnded={next} onError={next} onTimeUpdate={played} onPause={() => report.current.flush()} />
        {tuning && !blocked && (
          <span role="status" className="absolute left-4 bottom-16 flex items-center gap-2 font-mono text-xs tracking-[0.12em] uppercase text-bone bg-ink/80 px-3 py-2 rounded-full pointer-events-none">
            <span className="inline-block w-2 h-2 rounded-full bg-signal animate-pulse motion-reduce:animate-none" aria-hidden="true" />Tuning in to channel {channel.number}
          </span>
        )}
        {blocked && (
          <button type="button" onClick={() => video.current?.play().then(() => setBlocked(false))} className="absolute inset-0 flex items-center justify-center bg-ink/60">
            <span className="btn-primary btn-lg">Tap to play</span>
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className="text-bone min-w-0">
          <span className="font-display font-black text-signal tabular-nums mr-2">{channel.number}</span>
          {film.title}{film.year ? ` (${film.year})` : ''} <span className="text-muted">joined {minutes(slot.offset)} min in, on {channel.name}</span>
        </p>
        <div className="flex items-center gap-4">
          <a href={`/tv#${channel.id}`} className="nav-link hover:text-signal" data-track="inline-open-tv">Open on TV</a>
          <button type="button" onClick={onClose} className="nav-link hover:text-signal">Close</button>
        </div>
      </div>
    </div>
  );
}
