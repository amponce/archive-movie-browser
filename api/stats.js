// GET /api/stats  (Authorization: Bearer <STATS_TOKEN>): the numbers behind /stats.html.
import { timingSafeEqual } from 'node:crypto';
import { redis } from './_redis.js';

const BOARDS = ['opened', 'played', 'watched', 'searches', 'filters', 'referrers', 'pages', 'players', 'banner'];
const DAYS = 30;

function allowed(request) {
  const expected = process.env.STATS_TOKEN || '';
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (expected.length < 16 || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const pairs = (flat) => { const out = []; for (let i = 0; i < (flat || []).length; i += 2) out.push([flat[i], Number(flat[i + 1])]); return out; };

export async function GET(request) {
  if (!allowed(request)) return new Response('Not found', { status: 404 });
  const today = new Date();
  const days = Array.from({ length: DAYS }, (_, i) => new Date(today - i * 86400_000).toISOString().slice(0, 10)).reverse();
  const month = days.at(-1).slice(0, 7);
  const results = await redis([
    ...days.map(day => ['HGETALL', `stats:day:${day}`]),
    ...days.map(day => ['PFCOUNT', `stats:visitors:${day}`]),
    ['PFCOUNT', `stats:visitors:${month}`],
    ...BOARDS.map(board => ['ZREVRANGE', `stats:${board}:${month}`, 0, 24, 'WITHSCORES']),
  ], { readOnly: true });

  const body = {
    month,
    days: days.map((day, i) => ({ day, visitors: results[DAYS + i] || 0, events: Object.fromEntries(pairs(results[i])) })),
    visitorsThisMonth: results[2 * DAYS] || 0,
    boards: Object.fromEntries(BOARDS.map((board, i) => [board, pairs(results[2 * DAYS + 1 + i])])),
  };
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
