// Subtitle files from Archive.org, as WebVTT the browser can use. Archive.org doesn't let other
// sites read them, so /api/subtitles fetches the file and passes it on, converted. Nothing is kept.
const ID = /^[A-Za-z0-9._-]{1,200}$/;
export const MAX_BYTES = 3 * 1024 * 1024;

export const validSubtitleRequest = (id, file) => ID.test(String(id || ''))
  && typeof file === 'string' && file.length <= 300 && /\.(srt|vtt)$/i.test(file) && !file.split('/').some(part => part === '..' || part === '');

// UTF-8 when it is valid UTF-8, else Windows-1252, which older subtitle files mostly are
export function decodeText(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new TextDecoder('windows-1252').decode(bytes); }
}

// SubRip -> WebVTT: a header, dots for commas, and fractions of any length as milliseconds
// (Archive.org's auto captions write two digits: 00:00:48,26)
export function toVtt(text) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (/^WEBVTT/.test(clean)) return clean;
  const body = clean.replace(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/g, (all, h, m, s, f) => `${h.padStart(2, '0')}:${m}:${s}.${f.padEnd(3, '0')}`);
  return `WEBVTT\n\n${body.trim()}\n`;
}
