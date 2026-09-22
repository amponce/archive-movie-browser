// Logic for playing a film in our own <video> element instead of Archive.org's embedded player,
// which swallows keystrokes (no Escape, no shortcuts) and hides the playback position from us.

const MAX_STREAM_BYTES = 4e9; // a bigger "original" is a master copy, not something to stream

// Archive.org lists every file of an item; pick the one a browser can stream, or null to fall
// back to the embedded player. Only H.264 in MP4 plays everywhere (Safari has no Ogg).
export function pickPlayableFile(files) {
  const mp4s = (files || []).filter(file => /\.(mp4|m4v)$/i.test(file.name || '') && Number(file.size || 0) < MAX_STREAM_BYTES);
  const rank = (file) => {
    const format = String(file.format || '').toLowerCase();
    if (format.startsWith('h.264')) return 0;          // Archive.org's own streaming derivative
    if (file.source === 'original') return 1;          // what the uploader gave: usually the best picture
    if (format.includes('512kb')) return 3;            // small and soft, but always playable
    return 2;
  };
  return [...mp4s].sort((a, b) => rank(a) - rank(b))[0] || null;
}

export function videoUrl(identifier, fileName) {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${fileName.split('/').map(encodeURIComponent).join('/')}`;
}

// Keyboard shortcuts while a film plays. Null means "not ours": typing, buttons, browser shortcuts.
export function shortcutFor(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(event.target?.tagName)) return null;
  switch (event.key.toLowerCase()) {
    case 'arrowright': return { seek: event.shiftKey ? 60 : 10 };
    case 'arrowleft': return { seek: event.shiftKey ? -60 : -10 };
    case ' ': case 'k': return { toggle: true };
    case 'f': return { fullscreen: true };
    case 'm': return { mute: true };
    default: return null;
  }
}

// Positions are kept in this browser only (no account): identifier -> { time, duration, at }
export const POSITIONS_KEY = 'playback-positions';
export function readPositions() {
  try { return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}') || {}; } catch { return {}; }
}

// Films worth going back to: started, not finished, most recent first
export function unfinished(saved, limit = 6) {
  return Object.entries(saved)
    .filter(([, p]) => resumeTime(p) > 0)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, limit)
    .map(([identifier, p]) => ({ identifier, time: p.time, duration: p.duration }));
}

// Where to start a film that was watched before: not for the first half minute, not in the credits
export function resumeTime(saved) {
  if (!saved || saved.time < 30 || saved.time > saved.duration - 60) return 0;
  return saved.time;
}

export function rememberPosition(saved, identifier, { time, duration }, now = Date.now()) {
  const next = { ...saved, [identifier]: { time: Math.floor(time), duration: Math.floor(duration), at: now } };
  const oldestFirst = Object.keys(next).sort((a, b) => next[a].at - next[b].at);
  for (const key of oldestFirst.slice(0, Math.max(0, oldestFirst.length - 50))) delete next[key];
  return next;
}
