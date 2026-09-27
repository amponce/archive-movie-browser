// Hosted MCP endpoint: https://www.orphanedfilms.com/api/mcp (Streamable HTTP, stateless).
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

const hits = new Map(); // ip -> requests this clock minute; every address is forgotten when it ends
let minute = 0;
function overLimit(ip) {
  const now = Math.floor(Date.now() / 60_000);
  if (now !== minute || hits.size > 5000) { hits.clear(); minute = now; }
  const count = (hits.get(ip) || 0) + 1;
  hits.set(ip, count);
  return count > REQUESTS_PER_MINUTE;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

const mcp = createHandler({ wrap });

// Vercel stops the function at 30 s, and a request cut off there leaves its client with nothing,
// so some retry the same thing every 32 s. Every request gets an answer before then: a body that
// is still arriving after 10 s, or an answer not ready by 25 s, gets a JSON-RPC error.
export const limits = { bodyMs: 10_000, answerMs: 25_000 }; // the tests shorten them
const late = (ms) => new Promise(resolve => setTimeout(resolve, ms, 'late'));
const idsOf = (text) => { try { const body = JSON.parse(text); return [body].flat().map(m => m?.id).filter(id => id !== undefined); } catch { return []; } };
function tooSlow(ids, message) {
  const error = id => ({ jsonrpc: '2.0', error: { code: -32001, message }, id: id ?? null });
  const body = ids.length > 1 ? ids.map(error) : error(ids[0]);
  return new Response(JSON.stringify(body), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// One line per request in the Vercel logs: what was asked, by what client, how it ended
// ponytail: search words are logged (the site's own stats already count them); no addresses
function logLine(request, text, status, outcome, started) {
  let call = {};
  try { const body = JSON.parse(text); call = Array.isArray(body) ? { method: `batch of ${body.length}` } : { method: body.method, tool: body.params?.name, args: body.params?.arguments }; } catch { /* not JSON */ }
  console.log(JSON.stringify({ mcp: call.method || request.method, tool: call.tool, args: call.args && JSON.stringify(call.args).slice(0, 200), status, outcome, ms: Date.now() - started, client: (request.headers.get('user-agent') || '').slice(0, 80) }));
}

export async function handle(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  if (overLimit(ip)) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Too many requests, try again in a minute' }, id: null }),
      { status: 429, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': '60' } });
  }
  const started = Date.now();
  // The body is read here, with a limit, so a client that never finishes sending cannot hold the function
  let text = '';
  if (request.method === 'POST') {
    text = await Promise.race([request.text(), late(limits.bodyMs)]).catch(() => '');
    if (text === 'late') {
      logLine(request, '', 408, 'body never finished', started);
      return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'The request body never finished arriving' }, id: null }),
        { status: 408, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
  }
  const forward = new Request(request.url, { method: request.method, headers: request.headers, body: request.method === 'POST' ? text : undefined });
  // A stateless answer is one message, so it is read whole: then it is known to be ready in time
  const answer = (async () => {
    const response = await mcp.fetch(forward);
    return { response, body: await response.text() };
  })();
  const result = await Promise.race([answer, late(limits.answerMs - (Date.now() - started))]);
  if (result === 'late') {
    logLine(request, text, 200, 'too slow', started);
    return tooSlow(idsOf(text), 'Archive.org took too long to answer. Try again in a minute.');
  }
  const { response, body } = result;
  logLine(request, text, response.status, 'ok', started);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  headers.delete('content-length');
  return new Response(response.status === 202 || response.status === 204 ? null : body, { status: response.status, statusText: response.statusText, headers });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = handle;
