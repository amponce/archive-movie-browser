// GET /api/tmdb?path=search/movie&query=... | path=movie/<id>[&append_to_response=credits] | path=genre/movie/list
// TMDB through our edge cache: every visitor asking about the same film gets one cached answer, so
// TMDB sees one request per film a month instead of one per visitor, and the key stays here.
// Only the three lookups the site makes are passed on, with only the parameters it uses.

const PATHS = /^(search\/movie|movie\/\d{1,9}|genre\/movie\/list)$/;
const MONTH = 30 * 86400;

// A miss reaches TMDB, so misses are limited per address per minute (hits never reach this code)
const PER_MINUTE = 240;
const hits = new Map();
let minute = 0;
function overLimit(ip) {
  const now = Math.floor(Date.now() / 60_000);
  if (now !== minute || hits.size > 5000) { hits.clear(); minute = now; }
  const count = (hits.get(ip) || 0) + 1;
  hits.set(ip, count);
  return count > PER_MINUTE;
}

// The TMDB address for a request, or null when it is not one the site makes
export function tmdbUrl(query, key) {
  const path = String(query?.path || '');
  if (!key || !PATHS.test(path)) return null;
  const params = new URLSearchParams({ api_key: key });
  if (path === 'search/movie') {
    const text = String(query.query || '').trim().toLowerCase().slice(0, 200);
    if (!text) return null;
    params.set('query', text);
    params.set('include_adult', 'false');
  }
  if (path.startsWith('movie/') && query.append_to_response === 'credits') params.set('append_to_response', 'credits');
  return `https://api.themoviedb.org/3/${path}?${params}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  const key = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!key) { res.status(503).json({ error: 'TMDB is not set up on this server.' }); return; }
  const url = tmdbUrl(req.query, key);
  if (!url) { res.status(400).json({ error: 'Not a lookup this site makes.' }); return; }
  if (overLimit(String(req.headers?.['x-forwarded-for'] || 'unknown').split(',')[0].trim())) { res.status(429).json({ error: 'Too many lookups. Try again in a minute.' }); return; }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) { res.setHeader('Cache-Control', 'no-store'); res.status(response.status === 404 ? 404 : 502).json({ error: 'TMDB did not answer.' }); return; }
    res.setHeader('Cache-Control', `public, s-maxage=${MONTH}, stale-while-revalidate=${7 * 86400}`);
    res.status(200).json(await response.json());
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: 'TMDB did not answer.' });
  }
}
