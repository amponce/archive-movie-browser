// POST /api/event  { name, data }: one usage event from the site. Counts only; see _stats.js.
import { validEvent, commandsFor, isBot, visitorToken } from './_stats.js';
import { redis } from './_redis.js';

const PER_MINUTE = 60;
const hits = new Map(); // ponytail: per-instance memory, like api/mcp.js; enough to blunt a loop or a prank
function overLimit(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(at => now - at < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > PER_MINUTE;
}

const done = (status) => new Response(null, { status });

export async function POST(request) {
  // Only our own pages report events: a browser sets these headers and a page cannot fake them
  const site = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  if ((site && site !== 'same-origin') || (origin && new URL(origin).host !== new URL(request.url).host)) return done(403);

  const userAgent = request.headers.get('user-agent') || '';
  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  if (isBot(userAgent)) return done(204);
  if (overLimit(ip)) return done(429);

  let event;
  try {
    event = validEvent(JSON.parse((await request.text()).slice(0, 2000)));
  } catch { /* not JSON */ }
  if (!event) return done(400);

  const now = new Date();
  const visitor = event.name === 'Page view' ? await visitorToken(ip, userAgent, now.toISOString().slice(0, 10)) : undefined;
  try {
    await redis(commandsFor(event, { now, visitor }));
  } catch (error) {
    console.error('stats:', error.message);
    return done(503);
  }
  return done(204);
}
