import React from 'react';
import FilmPlayer from '../FilmPlayer';

// The player, at the top of the page while a film plays
export default function NowPlaying({ movie, onClose, playerRef }) {
  return (
    <div className="mb-8" ref={playerRef}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="eyebrow">Now playing</h3>
        <button onClick={onClose} className="nav-link">Close player</button>
      </div>
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
        <FilmPlayer movie={movie} />
      </div>
      <p className="mt-2 font-mono text-[11px] text-dim">
        Keyboard: ← → skip 10 seconds (hold Shift for a minute), Space pauses, F is full screen, M mutes, Esc closes.
      </p>
    </div>
  );
}
