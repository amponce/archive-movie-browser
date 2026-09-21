// Hosted MCP endpoint: https://archive-movie-browser.vercel.app/api/mcp (Streamable HTTP, stateless).
// Same tools as the local server in ../mcp. Public and read-only, so two guards keep it from
// being used to hammer Archive.org, which throttles busy clients.
// ponytail: both guards live in this instance's memory. Good enough while traffic is small;
// move to Vercel Firewall rate limiting and a shared cache if it gets real use.
import { createHandler } from '../mcp/register.mjs';

const CACHE_MINUTES = 15;
const MAX_CACHED = 500;
export const REQUESTS_PER_MINUTE = 40;

const cache = new Map(); // "tool:args" -> { at, value }
const wrap = (name, run) => async (args) => {
  const key = `${name}:${JSON.stringify(args)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MINUTES * 60_000) return hit.value;
  const value = await run(args);
  cache.delete(key);
  cache.set(key, { at: Date.now(), value });
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value);
  return value;
};

const hits = new Map(); // ip -> timestamps within the last minute
function overLimit(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(at => now - at < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > REQUESTS_PER_MINUTE;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

const mcp = createHandler({ wrap });

export async function handle(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  if (overLimit(ip)) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Too many requests, try again in a minute' }, id: null }),
      { status: 429, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': '60' } });
  }
  const response = await mcp.fetch(request);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = handle;
