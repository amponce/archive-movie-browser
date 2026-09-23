import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import archiveService from '../services/archive';
import { playableFiles, videoUrl, shortcutFor, resumeTime, rememberPosition, readPositions, POSITIONS_KEY, previewFrames, frameAt } from '../services/playback';
import { track } from '../services/analytics';
import useWatchReport from '../hooks/useWatchReport';
import useSubtitles, { SubtitleTracks, subtitleNote } from '../hooks/useSubtitles';


const clock = (seconds) => {
  const s = Math.floor(seconds);
  const pad = (n) => String(n).padStart(2, '0');
  return s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

// Plays the film in our own <video>, so the keyboard works (arrows scrub, Escape still closes the
// dialog) and the position is remembered. Falls back to Archive.org's embedded player whenever
// there is no file a browser can stream, or the one we picked fails to play.
// `files`: the file names to play, best first, when the upload holds several films (see UploadFilms)
export default function FilmPlayer({ movie, files }) {
  const [source, setSource] = useState(undefined); // undefined = looking, null = use the embed
  const [resumedAt, setResumedAt] = useState(0);
  const [frames, setFrames] = useState([]);
  const [hover, setHover] = useState(null); // { x (0..1), seconds } while the pointer is on the scrub strip
  const videoRef = useRef(null);
  const queue = useRef([]); // files still to try, best first, after the one playing
  const lastSaved = useRef(0);
  const watched = useRef({ seconds: 0, lastTick: 0, reported: false });
  const minutes = useWatchReport('film', { film: movie.identifier }, movie.identifier);
  const subtitles = useSubtitles(movie.identifier, source);

  // Which player ended up showing the film: ours, or Archive.org's as the fallback
  useEffect(() => {
    if (source !== undefined) track('Play', { film: movie.identifier, player: source ? 'own' : 'archive' });
  }, [source, movie.identifier]);

  useEffect(() => {
    let cancelled = false;
    setSource(undefined);
    archiveService.getMetadata(movie.identifier)
      .then(data => {
        if (cancelled) return;
        const names = files || playableFiles(data.files).map(file => file.name);
        const [first, ...rest] = names.map(name => videoUrl(movie.identifier, name));
        queue.current = rest;
        setSource(first || null);
        setFrames(previewFrames(movie.identifier, data.files));
      })
      .catch(() => { if (!cancelled) setSource(null); });
    return () => { cancelled = true; };
  }, [movie.identifier, files?.join('|')]);

  // The file would not play, or played sound over a black picture (a codec the browser has
  // no decoder for): the next file, or Archive.org's player when there is none left
  const nextFile = () => setSource(queue.current.shift() || null);

  const loaded = () => {
    if (videoRef.current.videoWidth === 0) return nextFile();
    resume();
  };

  // Shortcuts. Capture phase, so a focused <video> does not also handle the arrow keys itself.
  useEffect(() => {
    if (!source) return;
    const onKeyDown = (event) => {
      const video = videoRef.current;
      const action = video && shortcutFor(event);
      if (!action) return;
      event.preventDefault();
      if (action.seek) video.currentTime = Math.min(Math.max(0, video.currentTime + action.seek), video.duration || Infinity);
      if (action.toggle) video.paused ? video.play() : video.pause();
      if (action.mute) video.muted = !video.muted;
      if (action.fullscreen) document.fullscreenElement ? document.exitFullscreen() : video.requestFullscreen?.();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [source]);

  const resume = () => {
    const start = resumeTime(readPositions()[movie.identifier]);
    if (start) {
      videoRef.current.currentTime = start;
      setResumedAt(start);
    }
  };

  // Ten minutes of actual playback (not the position, which a resume or a skip can jump past)
  const countWatching = () => {
    const now = Date.now();
    const w = watched.current;
    if (!videoRef.current.paused && w.lastTick) {
      const played = Math.min((now - w.lastTick) / 1000, 1);
      w.seconds += played;
      minutes.current.add(played);
    }
    w.lastTick = now;
    if (w.seconds >= 600 && !w.reported) {
      w.reported = true;
      track('Watched 10 minutes', { film: movie.identifier });
    }
  };

  const savePosition = () => {
    const video = videoRef.current;
    if (!video?.duration || Date.now() - lastSaved.current < 5000) return;
    lastSaved.current = Date.now();
    try {
      localStorage.setItem(POSITIONS_KEY, JSON.stringify(rememberPosition(readPositions(), movie.identifier, { time: video.currentTime, duration: video.duration })));
    } catch { /* private mode */ }
  };

  // The scrub strip: a thin band over the bottom of the picture. Hovering shows the frame and
  // the time for that spot, clicking goes there. The native controls keep doing everything else.
  const scrub = (event) => {
    const video = videoRef.current;
    if (!video?.duration) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    return { x, seconds: x * video.duration };
  };
  const preview = hover && frames.length ? frameAt(frames, hover.seconds) : null;

  if (source === undefined) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Finding the film on Archive.org
      </div>
    );
  }

  if (source === null) {
    return (
      <iframe
        src={`https://archive.org/embed/${movie.identifier}`}
        className="absolute inset-0 w-full h-full"
        frameBorder="0"
        allowFullScreen
        allow="autoplay; fullscreen"
        title={movie.title}
      />
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        src={source}
        controls
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full bg-black"
        aria-label={movie.title}
        onLoadedMetadata={loaded}
        onTimeUpdate={() => { countWatching(); savePosition(); }}
        onPause={() => minutes.current.flush()}
        onError={nextFile}
      >
        <SubtitleTracks identifier={movie.identifier} tracks={subtitles} />
      </video>
      {subtitleNote(subtitles) && <p className="absolute left-3 top-3 font-mono text-[10px] tracking-[0.1em] uppercase text-bone/80 bg-ink/70 px-2 py-1 rounded-sm pointer-events-none">{subtitleNote(subtitles)}</p>}
      {frames.length > 0 && (
        <div
          className="absolute left-0 right-0 bottom-[52px] h-7 cursor-pointer"
          onMouseMove={(e) => setHover(scrub(e))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => { const at = scrub(e); if (at) videoRef.current.currentTime = at.seconds; }}
          aria-hidden="true"
        >
          {hover && (
            <div className="absolute bottom-full mb-2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none" style={{ left: `${hover.x * 100}%` }}>
              {preview && <img src={preview.url} alt="" className="w-40 aspect-video object-cover rounded border border-white/20 shadow-2xl bg-black" />}
              <span className="font-mono text-xs bg-black/80 text-white rounded px-1.5 py-0.5 tabular-nums">{clock(hover.seconds)}</span>
            </div>
          )}
        </div>
      )}
      {resumedAt > 0 && (
        <div className="absolute top-3 left-3 flex items-center gap-3 bg-black/80 text-white text-sm rounded px-3 py-1.5">
          <span>Resumed at {clock(resumedAt)}</span>
          <button
            className="underline underline-offset-2 hover:no-underline"
            onClick={() => { videoRef.current.currentTime = 0; setResumedAt(0); }}
          >
            Start over
          </button>
        </div>
      )}
    </>
  );
}
