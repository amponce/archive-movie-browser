// The Cloudflare Worker in front of api/. Static files (the built site in dist/) are served by
// Cloudflare before this runs; only /api/*, /sitemap.xml, /c/* and /u/* reach it (wrangler.jsonc).
import archiveList from './api/archive-list.js';
import sitemap from './api/sitemap.js';
import subtitles from './api/subtitles.js';
import tmdb from './api/tmdb.js';
import tv from './api/tv.js';
import { POST as event } from './api/event.js';
import { GET as stats } from './api/stats.js';
import { handle as mcp } from './api/mcp.js';
import { handle as community } from './api/community.js';
import * as webauthn from '@simplewebauthn/server';
import { redis } from './api/_redis.js';
import { isForbidden, isMature } from './src/services/policy.js';
import { route } from './api/_routes.js';
import { getChannel, getProfile, isListed, movedHandle, ID } from './api/_community.js';
import { HANDLE } from './src/services/handle.js';
import posterIndex from './public/poster-index.json' with { type: 'json' };

const months = (now = new Date()) => [0, 1].map(back => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)).toISOString().slice(0, 7));
async function redisMinutes(members) {
  if (!members.length) return {};
  const scores = await redis(months().map(m => ['ZMSCORE', `stats:channel-minutes:${m}`, ...members]), { readOnly: true }).catch(() => []);
  return Object.fromEntries(members.map((m, i) => [m, scores.reduce((sum, list) => sum + (Number(list?.[i]) || 0), 0)]));
}
// A film's verdict is remembered for this instance; a lookup that failed (slow, down, no
// record) is not, so it is asked again later
const verdicts = new Map();
async function archiveFlag(film) {
  if (verdicts.has(film)) return verdicts.get(film);
  const meta = await fetch(`https://archive.org/metadata/${encodeURIComponent(film)}/metadata`, { signal: AbortSignal.timeout(5000) }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!meta?.result) return true;
  const verdict = isForbidden(meta.result) ? 'forbidden' : isMature(meta.result);
  if (verdicts.size > 2000) verdicts.clear(); // ponytail: a whole reset, as in api/_tv.js
  verdicts.set(film, verdict);
  return verdict;
}

// The handlers written for (req, res), run with a web Request and answered with a Response
const node = (handler) => async (request, query, env) => {
  const req = { method: request.method, query, headers: Object.fromEntries(request.headers) };
  let status = 200, body = null;
  const headers = new Headers();
  const res = {
    status(code) { status = code; return res; },
    setHeader(key, value) { headers.set(key, value); return res; },
    json(value) { headers.set('Content-Type', 'application/json'); body = JSON.stringify(value); },
    send(value) { body = value; },
    end(value) { body = value ?? null; },
  };
  await handler(req, res, env);
  return new Response(body, { status, headers });
};

const web = (handler, method) => (request) => (request.method === method ? handler(request) : new Response(null, { status: 405 }));

const API = {
  'archive-list': node(archiveList),
  sitemap: node(sitemap),
  subtitles: node(subtitles),
  tmdb: node(tmdb),
  tv: node(tv),
  event: web(event, 'POST'),
  stats: web(stats, 'GET'),
  mcp: (request) => mcp(request),
  community: (request, query, env) => community(request, { db: env.DB, flag: archiveFlag, minutes: redisMinutes, webauthn, now: Date.now() }),
};

// The share card's picture: the poster of the first film that has one
const posterOf = (films) => {
  for (const film of films) {
    const entry = posterIndex.films[film];
    if (entry?.p && !isForbidden({ title: entry.t })) return `https://image.tmdb.org/t/p/w500${entry.p}`;
  }
  return null;
};

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// /c/<id>, /u/<id> and /u/<handle>: the app's page with a share preview; unlisted channels and
// profiles are noindex. A profile with a handle names /u/<handle> as its address; a handle it
// gave up redirects to it while held.
async function sharePage(request, env, kind, id) {
  const asset = await env.ASSETS.fetch(new Request(new URL('/', request.url)));
  const headers = new Headers(asset.headers);
  headers.delete('ETag');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex');
  let html = await asset.text();
  let data;
  let moved;
  try {
    data = kind === 'c' ? await getChannel(env.DB, id) : await getProfile(env.DB, id);
    moved = !data && kind === 'u' && await movedHandle(env.DB, id, Date.now());
  } catch {
    return new Response(html, { status: asset.status, headers });
  }
  if (moved) return new Response(null, { status: 308, headers: { Location: new URL(`/u/${moved}${new URL(request.url).search}`, request.url).href, 'Cache-Control': 'no-store' } });
  const listed = kind === 'c' && !!data && isListed(data.status) && !data.films.some(f => f.flagged);
  const title = data ? `${data.name || 'A profile'} | Orphaned Films` : 'Orphaned Films';
  const description = data && kind === 'c' ? `${data.films.length} ${data.films.length === 1 ? 'film' : 'films'}${data.owner ? ` · by ${data.owner}` : ''}` : 'Forgotten films, found.';
  const image = data && posterOf(kind === 'c' ? data.films.map(f => f.film) : data.favourites);
  const meta = `<meta property="og:title" content="${escapeHtml(title)}"><meta name="description" content="${escapeHtml(description)}"><meta property="og:description" content="${escapeHtml(description)}">${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">${listed ? '' : '<meta name="robots" content="noindex">'}${kind === 'u' && data?.handle ? `<link rel="canonical" href="${escapeHtml(new URL(`/u/${data.handle}`, request.url).href)}">` : ''}`;
  html = html.replace(/<meta (?:name="description"|property="og:(?:title|description|image[^"]*)"|name="twitter:card")[^>]*>\s*/g, '');
  if (data) html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>`);
  html = html.replace('</head>', () => `${meta}</head>`);
  if (listed) headers.delete('X-Robots-Tag');
  return new Response(html, { status: data ? 200 : 404, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const share = ['GET', 'HEAD'].includes(request.method) && url.pathname.match(/^\/(c|u)\/([a-z0-9_-]+)\/?$/);
    if (share && (ID.test(share[2]) || (share[1] === 'u' && HANDLE.test(share[2])))) return sharePage(request, env, share[1], share[2]);
    // Handles are lower case; /u/Night-Owl goes to /u/night-owl
    const upper = url.pathname.match(/^\/u\/([A-Za-z0-9_-]+)\/?$/);
    if (upper && upper[1] !== upper[1].toLowerCase() && HANDLE.test(upper[1].toLowerCase())) return Response.redirect(new URL(`/u/${upper[1].toLowerCase()}${url.search}`, url).href, 308);
    if (/^\/[cu]\//.test(url.pathname)) return env.ASSETS.fetch(request);
    const found = route(url.pathname);
    if (!found) return new Response('Not found', { status: 404 });
    const query = { ...Object.fromEntries(url.searchParams), ...found.query };
    // Answers marked s-maxage are kept in Cloudflare's cache for that long, as Vercel's CDN did
    const cacheable = request.method === 'GET' && found.name !== 'stats' && (found.name !== 'community' || url.pathname === '/api/channels');
    // The channel listing ignores its query string, so it is cached under the bare path
    const cacheKey = found.name === 'community' ? new Request(new URL(url.pathname, request.url)) : request;
    if (cacheable) {
      const hit = await caches.default.match(cacheKey);
      if (hit) return hit;
    }
    const response = await API[found.name](request, query, env);
    if (cacheable && response.status === 200 && /s-maxage=\d+/.test(response.headers.get('Cache-Control') || '')) {
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    }
    return response;
  },
};
