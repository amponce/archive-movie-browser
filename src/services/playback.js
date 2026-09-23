// Logic for playing a film in our own <video> element instead of Archive.org's embedded player,
// which swallows keystrokes (no Escape, no shortcuts) and hides the playback position from us.

const MAX_STREAM_BYTES = 4e9; // a bigger "original" is a master copy, not something to stream

// Archive.org lists every file of an item; the ones a browser can stream, best first, so the
// player can move to the next when one loads with no picture. Only H.264 in MP4 plays
// everywhere (Safari has no Ogg). Archive.org labels every uploaded mp4 "MPEG4" whatever its
// codec, so an original may turn out to be DivX-era video the browser cannot decode: sound
// and a black picture. The 512kb derivative is always H.264.
export function playableFiles(files) {
  const mp4s = (files || []).filter(file => /\.(mp4|m4v)$/i.test(file.name || '') && Number(file.size || 0) < MAX_STREAM_BYTES);
  const rank = (file) => {
    const format = String(file.format || '').toLowerCase();
    if (format.startsWith('h.264')) return 0;          // Archive.org's own streaming derivative
    if (file.source === 'original') return 1;          // what the uploader gave: usually the best picture
    if (format.includes('512kb')) return 3;            // small and soft, but always playable
    return 2;
  };
  return [...mp4s].sort((a, b) => rank(a) - rank(b));
}

// An upload that is really several films (one item holding many feature-length videos, as some
// people use Archive.org to keep a list): one entry per film, named from its file, with the files
// that can play it best first. Fewer than two films: null, it's an ordinary upload.
const VIDEO = /\.(mp4|m4v|mkv|avi|ogv|mpeg|mpg|mov|wmv)$/i;
const stem = name => name.replace(/\.ia\.mp4$/i, '').replace(VIDEO, '');
// "Aladdin 2019" or "Aladdin (2019)" -> { title: 'Aladdin', year: 2019 }
const titleAndYear = (name) => {
  const match = name.match(/^(.+?)\s*\(?((?:19|20)\d{2})\)?$/);
  return match ? { title: match[1], year: Number(match[2]) } : { title: name, year: null };
};
export function filmsInUpload(files, minSeconds = 40 * 60) {
  const groups = new Map();
  for (const file of files || []) {
    if (!VIDEO.test(file.name || '')) continue;
    const key = stem(file.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }
  const films = [...groups].map(([key, group]) => ({
    key,
    ...titleAndYear(key.split('/').pop().replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim()),
    seconds: Math.max(0, ...group.map(file => Number(file.length) || 0)),
    files: playableFiles(group).map(file => file.name),
  })).filter(film => film.files.length && (!film.seconds || film.seconds >= minSeconds));
  return films.length >= 2 ? films.sort((a, b) => a.title.localeCompare(b.title)) : null;
}

// The first choice, or null to fall back to the embedded player
export function pickPlayableFile(files) {
  return playableFiles(files)[0] || null;
}

export function videoUrl(identifier, fileName) {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${fileName.split('/').map(encodeURIComponent).join('/')}`;
}

// Archive.org keeps a frame every minute or so for most items, named <base>_000060.jpg where
// the number is the second. As a sorted list they make a scrub preview with no work of ours.
export function previewFrames(identifier, files) {
  return (files || [])
    .map(file => ({ file, match: /\.thumbs\/.*_(\d{6})\.jpg$/i.exec(file.name || '') }))
    .filter(({ match }) => match)
    .map(({ file, match }) => ({ seconds: Number(match[1]), url: videoUrl(identifier, file.name) }))
    .sort((a, b) => a.seconds - b.seconds);
}

// The frame to show for a moment in the film: the last one at or before it
export function frameAt(frames, seconds) {
  let best = null;
  for (const frame of frames) { if (frame.seconds <= seconds) best = frame; else break; }
  return best || frames[0] || null;
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

// Films worth going back to: started, not finished, long enough to be a film (a trailer or a
// clip is never worth a card), most recent first
const FILM_LENGTH = 20 * 60;
export function unfinished(saved, limit = 6) {
  return Object.entries(saved)
    .filter(([, p]) => resumeTime(p) > 0 && p.duration >= FILM_LENGTH)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, limit)
    .map(([identifier, p]) => ({ identifier, time: p.time, duration: p.duration }));
}

// Where to start a film that was watched before: not for the first half minute, not in the credits
export function resumeTime(saved) {
  if (!saved || saved.time < 30 || saved.time > saved.duration - 60) return 0;
  return saved.time;
}

export function forgetPosition(saved, identifier) {
  const next = { ...saved };
  delete next[identifier];
  return next;
}

export function rememberPosition(saved, identifier, { time, duration }, now = Date.now()) {
  const next = { ...saved, [identifier]: { time: Math.floor(time), duration: Math.floor(duration), at: now } };
  const oldestFirst = Object.keys(next).sort((a, b) => next[a].at - next[b].at);
  for (const key of oldestFirst.slice(0, Math.max(0, oldestFirst.length - 50))) delete next[key];
  return next;
}
