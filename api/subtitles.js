// GET /api/subtitles?id=<upload>&file=<name>.srt : that subtitle file as WebVTT (see _subtitles.js)
import { validSubtitleRequest, decodeText, toVtt, MAX_BYTES } from './_subtitles.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  const { id, file } = req.query || {};
  if (!validSubtitleRequest(id, file)) { res.status(400).send('Needs id (an upload) and file (a .srt or .vtt in it).'); return; }
  try {
    const url = `https://archive.org/download/${encodeURIComponent(id)}/${file.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) { res.status(404).send('No such subtitle file.'); return; }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES) { res.status(413).send('That subtitle file is too large.'); return; }
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(toVtt(decodeText(bytes)));
  } catch {
    res.status(502).send('Archive.org did not answer.');
  }
}
