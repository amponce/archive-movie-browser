// GET /api/halloween: how many visits ticked each 31 Days of Horror film as seen, and how many
// ticked anything. Estimates from the HyperLogLogs api/_stats.js fills; no ids, no auth.
import { redis } from './_redis.js';
import { FILMS } from '../src/halloween/days.js';

// { seen: { <film>: n }, people: n }. PFCOUNT needs the main token (see api/stats.js).
export async function seenCounts() {
  const counts = await redis([...FILMS.map(film => ['PFCOUNT', `stats:halloween:seen:${film}`]), ['PFCOUNT', 'stats:halloween:seen-any']]);
  return { seen: Object.fromEntries(FILMS.map((film, i) => [film, Number(counts[i]) || 0])), people: Number(counts.at(-1)) || 0 };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  try {
    const body = await seenCounts();
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(200).json(body);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'The counts are not available right now.' });
  }
}
