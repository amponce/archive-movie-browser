// POST /api/event  { name, data }: one usage event from the site. Counts only; see _stats.js.
import { validEvent, commandsFor, isBot, visitorToken, statsDay, mergeCommands } from './_stats.js';
import { redis } from './_redis.js';

const PER_MINUTE = 60;
const hits = new Map(); // ponytail: per-instance memory, like api/mcp.js; enough to blunt a loop or a prank
let minute = 0;
// Counts per clock minute; every address is forgotten when the next minute's first event arrives
// (an address is held for a minute at most)
function overLimit(ip) {
  const now = Math.floor(Date.now() / 60_000);
  if (now !== minute || hits.size > 5000) { hits.clear(); minute = now; }
  const count = (hits.get(ip) || 0) + 1;
  hits.set(ip, count);
  return count > PER_MINUTE;
}

const done = (status) => new Response(null, { status });

const FLUSH_MS = 30_000;
const pending = [];
let lastWrite = 0;
let events = 0;

// "null" (sandboxed frames, some redirects) and other non-URL values are real Origin headers
const originHost = (origin) => { try { return new URL(origin).host; } catch { return null; } };

export async function POST(request) {
  // Only our own pages report events: a browser sets these headers and a page cannot fake them.
  // A request with neither is not from a browser page, so it is not counted.
  const site = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  if (!site && !origin) return done(403);
  if (site && site !== 'same-origin') return done(403);
  if (origin && originHost(origin) !== new URL(request.url).host) return done(403);

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
  const visitor = event.name === 'Page view' ? await visitorToken(ip, userAgent, statsDay(now)) : undefined;
  pending.push(...commandsFor(event, { now, visitor }));
  // Written together, at most every 30 seconds (or every 200 events) per server instance: the
  // database bills per command, and one merged write replaces hundreds.
  // ponytail: an instance that stops before its next write loses those seconds of counts
  if (Date.now() - lastWrite >= FLUSH_MS || ++events >= 200) {
    const batch = mergeCommands(pending.splice(0));
    lastWrite = Date.now();
    events = 0;
    try {
      await redis(batch);
    } catch (error) {
      console.error('stats:', error.message);
      return done(503);
    }
  }
  return done(204);
}
