// GET /api/tv            JSON: channels, what is on, the next hours
// GET /api/tv?format=m3u the lineups as an M3U playlist for other players
// GET /api/tv?format=xml the guide as XMLTV
// GET /api/tv?format=channels one entry per channel for IPTV apps (/api/tv/channels.m3u)
// GET /api/tv?live=<channel> a redirect to the film on that channel now (/api/tv/live/<channel>)
// Add &mine=a,b,c (the identifiers from a shared channel link) to get just that channel.
// Same schedule for everyone, so the whole thing is cached at the edge for a minute.
import { schedule, personalChannel, toM3U, toChannelsM3U, liveStreams, toXMLTV } from './_tv.js';

// Whether a stream still answers (an Archive.org file can be removed mid-week), remembered for
// ten minutes. Unsure (slow, network trouble) counts as yes: better a try than dead air.
const alive = new Map();
async function answers(url) {
  const known = alive.get(url);
  if (known && Date.now() - known.at < 600_000) return known.ok;
  let ok = true;
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(2500) });
    ok = r.status < 400;
  } catch { /* unsure */ }
  alive.set(url, { ok, at: Date.now() });
  return ok;
}
const siteOf = req => {
  const host = String(req.headers?.host || 'www.orphanedfilms.com');
  return `${/^(localhost|127\.|192\.168\.)/.test(host) ? 'http' : 'https'}://${host}`;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  const format = String(req.query?.format || 'json');
  try {
    if (req.query?.live) {
      const candidates = liveStreams(schedule({ hours: 6 }), String(req.query.live));
      if (!candidates.length) { res.status(404).json({ error: 'No such channel, or nothing on it now.' }); return; }
      // The film on now, or the next one whose file still answers
      let url = candidates[0];
      for (const candidate of candidates) { if (await answers(candidate)) { url = candidate; break; } }
      res.setHeader('Cache-Control', 'no-store'); // what is on changes; every tune asks again
      res.setHeader('Location', url);
      res.status(302).end();
      return;
    }
    const mine = String(req.query?.mine || '');
    // Three days of guide: apps refresh it every 6 to 24 hours and show about two days
    const hours = format === 'xml' ? 72 : 6;
    const data = mine ? { now: Date.now(), channels: [await personalChannel(mine.split(','), { hours })] } : schedule({ hours });
    res.setHeader('Cache-Control', mine ? 'public, s-maxage=300' : 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (format === 'channels') {
      res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="orphaned-films-channels.m3u"');
      res.status(200).send(toChannelsM3U(data, siteOf(req)));
    } else if (format === 'm3u') {
      res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="orphaned-films.m3u"');
      res.status(200).send(toM3U(data));
    } else if (format === 'xml') {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.status(200).send(toXMLTV(data));
    } else {
      res.status(200).json(data);
    }
  } catch (error) {
    res.status(502).json({ error: `Could not build the schedule: ${error.message}` });
  }
}
