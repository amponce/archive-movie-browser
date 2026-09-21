import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import archiveService from '../services/archive';
import { pickPlayableFile, videoUrl, shortcutFor, resumeTime, rememberPosition } from '../services/playback';

const POSITIONS_KEY = 'playback-positions';

function readPositions() {
  try { return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}') || {}; } catch { return {}; }
}

const clock = (seconds) => {
  const s = Math.floor(seconds);
  const pad = (n) => String(n).padStart(2, '0');
  return s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

// Plays the film in our own <video>, so the keyboard works (arrows scrub, Escape still closes the
// dialog) and the position is remembered. Falls back to Archive.org's embedded player whenever
// there is no file a browser can stream, or the one we picked fails to play.
export default function FilmPlayer({ movie }) {
  const [source, setSource] = useState(undefined); // undefined = looking, null = use the embed
  const [resumedAt, setResumedAt] = useState(0);
  const videoRef = useRef(null);
  const lastSaved = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setSource(undefined);
    archiveService.getMetadata(movie.identifier)
      .then(data => {
        const file = pickPlayableFile(data.files);
        if (!cancelled) setSource(file ? videoUrl(movie.identifier, file.name) : null);
      })
      .catch(() => { if (!cancelled) setSource(null); });
    return () => { cancelled = true; };
  }, [movie.identifier]);

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

  const savePosition = () => {
    const video = videoRef.current;
    if (!video?.duration || Date.now() - lastSaved.current < 5000) return;
    lastSaved.current = Date.now();
    try {
      localStorage.setItem(POSITIONS_KEY, JSON.stringify(rememberPosition(readPositions(), movie.identifier, { time: video.currentTime, duration: video.duration })));
    } catch { /* private mode */ }
  };

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
        onLoadedMetadata={resume}
        onTimeUpdate={savePosition}
        onError={() => setSource(null)}
      />
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
