// GET /api/archive-list?user=jason_scott&list=1 : someone's Archive.org list (see _archiveList.js)
// GET /api/archive-list?user=jason_scott : the public lists they keep
import { listUrl, validRequest, validUser, summarize, summarizeLists } from './_archiveList.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  const { user, list } = req.query || {};
  const all = list === undefined || list === '';
  if (all ? !validUser(user) : !validRequest(user, list)) { res.status(400).json({ error: 'Needs user (an Archive.org screen name) and list (a number).' }); return; }
  try {
    const answer = await fetch(listUrl(user, all ? null : list), { signal: AbortSignal.timeout(8000) }).then(r => r.json());
    const summary = all ? summarizeLists(answer) : summarize(answer);
    if (!summary) { res.status(404).json({ error: all ? 'There is no one by that name on Archive.org.' : 'That list does not exist, or it is private.' }); return; }
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json(all ? { user, lists: summary } : { user, list: Number(list), ...summary });
  } catch {
    res.status(502).json({ error: 'Archive.org did not answer. Try again in a moment.' });
  }
}
