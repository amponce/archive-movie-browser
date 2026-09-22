// GET /api/tv            JSON: channels, what is on, the next hours
// GET /api/tv?format=m3u the lineups as an M3U playlist for other players
// GET /api/tv?format=xml the guide as XMLTV
// Same schedule for everyone, so the whole thing is cached at the edge for a minute.
import { schedule, toM3U, toXMLTV } from './_tv.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  const format = String(req.query?.format || 'json');
  try {
    const data = await schedule({ hours: format === 'xml' ? 24 : 6 });
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (format === 'm3u') {
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
