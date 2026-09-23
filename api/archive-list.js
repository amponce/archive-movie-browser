// GET /api/archive-list?user=jason_scott&list=1 : someone's Archive.org list (see _archiveList.js)
import { listUrl, validRequest, summarize } from './_archiveList.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  const { user, list } = req.query || {};
  if (!validRequest(user, list)) { res.status(400).json({ error: 'Needs user (an Archive.org screen name) and list (a number).' }); return; }
  try {
    const answer = await fetch(listUrl(user, list), { signal: AbortSignal.timeout(8000) }).then(r => r.json());
    const summary = summarize(answer);
    if (!summary) { res.status(404).json({ error: 'That list does not exist, or it is private.' }); return; }
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ user, list: Number(list), ...summary });
  } catch {
    res.status(502).json({ error: 'Archive.org did not answer. Try again in a moment.' });
  }
}
