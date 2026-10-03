// /api/profile, /api/channel, /api/channels, /api/passkey
import { createProfile, authProfile, getProfile, updateProfile, setFavourite, createChannel, getChannel, updateChannel, deleteChannel, submitChannel, setSaved, listChannels, hashKey, isListed } from './_community.js';
import { rpFor, isPasskeyId, registrationOptions, register, listPasskeys, removePasskey, signinOptions, signin } from './_passkeys.js';

const MAX_BODY = 20_000;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...headers } });
const empty = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
const originHost = origin => { try { return new URL(origin).host; } catch { return null; } };

function sameSite(request) {
  const site = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  if (!site && !origin) return false;
  if (site && site !== 'same-origin') return false;
  return !origin || originHost(origin) === new URL(request.url).host;
}

// The address is never stored: limits are keyed by a hash of it that changes every UTC day
// (salted with LIMIT_SALT when the Worker has one), cut to 16 hex characters
const salt = () => (typeof process !== 'undefined' && process.env?.LIMIT_SALT) || '';
export const addressKey = async (ip, now) => (await hashKey(`${new Date(now).toISOString().slice(0, 10)}|${salt()}|${ip}`)).slice(0, 16);

// Fixed-window counter in the limits table. Every write here also drops expired rows, in the
// same round trip: the table only ever holds the last hour's rows, so the sweep is small, and no
// row outlives its window by more than the next write from anyone.
async function overLimit(db, bucket, max, windowMs, now) {
  const row = await db.prepare('SELECT count, until FROM limits WHERE bucket = ?').bind(bucket).first();
  if (row && row.until > now && row.count >= max) return true;
  await db.batch([
    db.prepare('DELETE FROM limits WHERE until <= ?').bind(now),
    row && row.until > now
      ? db.prepare('UPDATE limits SET count = count + 1 WHERE bucket = ?').bind(bucket)
      : db.prepare('INSERT OR REPLACE INTO limits (bucket, count, until) VALUES (?, 1, ?)').bind(bucket, now + windowMs),
  ]);
  return false;
}

// New films looked up on Archive.org per address per hour; past it a new film is stored
// flagged without a lookup, and a submit re-checks it once the hour is over
export const LOOKUPS = 200;
async function withLookups(db, bucket, flag, now, run) {
  const row = await db.prepare('SELECT count, until FROM limits WHERE bucket = ?').bind(bucket).first();
  const live = row && row.until > now;
  let used = 0;
  const left = LOOKUPS - (live ? row.count : 0);
  try {
    return await run(film => (used < left ? (used++, flag(film)) : true));
  } finally {
    if (used) {
      await (live
        ? db.prepare('UPDATE limits SET count = count + ? WHERE bucket = ?').bind(used, bucket)
        : db.prepare('INSERT OR REPLACE INTO limits (bucket, count, until) VALUES (?, ?, ?)').bind(bucket, used, now + 3_600_000)).run();
    }
  }
}

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY) return { tooBig: true };
  const text = await request.text();
  if (text.length > MAX_BODY) return { tooBig: true };
  try { return { body: text ? JSON.parse(text) : {} }; } catch { return { body: null }; }
}

async function owner(request, db) {
  const [id, key] = (request.headers.get('authorization') || '').replace(/^Bearer /, '').split('.');
  return authProfile(db, id, key);
}

export async function handle(request, deps) {
  try { return await route(request, deps); } catch (error) { console.error('community:', error.message); return empty(500); }
}

async function route(request, deps) {
  const { db, flag, minutes, now } = deps;
  const url = new URL(request.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/').slice(2); // ['profile', id, ...]
  const method = request.method;

  if (parts[0] === 'passkey') return passkeyRoute(request, parts, deps);

  if (parts[0] === 'channels' && parts.length === 1) {
    if (method !== 'GET') return empty(405);
    return json({ channels: await listChannels(db, { minutes }) }, 200, { 'Cache-Control': 'public, s-maxage=60' });
  }

  if (method === 'GET') {
    if (parts[0] === 'profile' && parts.length === 2) {
      const p = await getProfile(db, parts[1]);
      return p ? json(p, 200, { 'X-Robots-Tag': 'noindex' }) : empty(404);
    }
    if (parts[0] === 'channel' && parts.length === 2) {
      const c = await getChannel(db, parts[1]);
      if (!c) return empty(404);
      const { profileId, ...open } = c;
      // The owner's own id comes back only to the owner, so the page can show the editor
      if (request.headers.get('authorization') && (await owner(request, db))?.id === profileId) open.ownerId = profileId;
      return json(open, 200, isListed(c.status) && !c.films.some(f => f.flagged) ? {} : { 'X-Robots-Tag': 'noindex' });
    }
    return empty(404);
  }

  if (!sameSite(request)) return empty(403);
  const address = await addressKey(request.headers.get('cf-connecting-ip') || 'unknown', now);
  if (await overLimit(db, `w:${address}`, 120, 60_000, now)) return empty(429);

  if (method === 'POST' && parts[0] === 'profile' && parts.length === 1) {
    if (await overLimit(db, `p:${address}`, 5, 3_600_000, now)) return empty(429);
    return json(await createProfile(db, { now }), 201);
  }

  const { body, tooBig } = await readBody(request);
  if (tooBig) return empty(413);
  if (body === null) return empty(400);
  const me = await owner(request, db);
  if (!me) return empty(401);

  if (parts[0] === 'profile' && parts[1] === me.id) {
    if (method === 'PATCH' && parts.length === 2) { return (await updateProfile(db, me.id, body, { now })) === 'reserved' ? json({ error: 'reserved' }, 400) : empty(204); }
    if (parts[2] === 'favourites' && parts.length === 4 && (method === 'PUT' || method === 'DELETE')) {
      let film;
      try { film = decodeURIComponent(parts[3]); } catch { return empty(400); }
      return empty(await setFavourite(db, me.id, film, method === 'PUT', { now }) ? 204 : 400);
    }
    return empty(405);
  }
  if (parts[0] === 'profile') return empty(404);

  if (parts[0] === 'channel') {
    const looked = run => withLookups(db, `l:${address}`, flag, now, run);
    if (method === 'POST' && parts.length === 1) {
      const id = await looked(f => createChannel(db, me.id, body, { now, flag: f }));
      return id ? json({ id }, 201) : empty(409);
    }
    const id = parts[1];
    if (parts.length === 2 && method === 'PATCH') return empty(await looked(f => updateChannel(db, id, me.id, body, { now, flag: f })) ? 204 : 404);
    if (parts.length === 2 && method === 'DELETE') return empty(await deleteChannel(db, id, me.id) ? 204 : 404);
    if (parts[2] === 'submit' && method === 'POST') {
      const problem = await looked(f => submitChannel(db, id, me.id, { now, flag: f }));
      return problem ? json({ problem }, 409) : empty(204);
    }
    if (parts[2] === 'save' && (method === 'PUT' || method === 'DELETE')) return empty(await setSaved(db, me.id, id, method === 'PUT', { now }) ? 204 : 404);
  }
  return empty(404);
}

// Passkeys: an owner adds them to a profile; anyone holding one gets that profile's new edit key
async function passkeyRoute(request, parts, { db, webauthn, now }) {
  const method = request.method;
  const rp = rpFor(request.headers.get('origin') || new URL(request.url).origin, request.url);
  if (!rp) return empty(403);
  const who = await addressKey(request.headers.get('cf-connecting-ip') || 'unknown', now);
  // GET is read-only and answers only the caller's own passkeys
  if (method === 'GET' && parts.length === 1) {
    const me = await owner(request, db);
    return me ? json({ passkeys: await listPasskeys(db, me.id) }) : empty(401);
  }
  if (!sameSite(request)) return empty(403);
  if (method === 'POST' && parts[1] === 'challenge' && parts.length === 2) {
    if (await overLimit(db, `pk:${who}`, 30, 3_600_000, now)) return empty(429);
    return json(await signinOptions(db, webauthn, { rp, now }));
  }
  if (method === 'POST' && parts[1] === 'verify' && parts.length === 2) {
    if (await overLimit(db, `pv:${who}`, 30, 3_600_000, now)) return empty(429);
    const { body, tooBig } = await readBody(request);
    if (tooBig) return empty(413);
    if (!body) return empty(400);
    const out = await signin(db, webauthn, body, { rp, now });
    if (out === 'hidden') return empty(403);
    return typeof out === 'string' ? json({ error: out }, 400) : json(out);
  }
  const me = await owner(request, db);
  if (!me) return empty(401);
  if (method === 'POST' && parts[1] === 'options' && parts.length === 2) {
    if (await overLimit(db, `pk:${who}`, 30, 3_600_000, now)) return empty(429);
    const out = await registrationOptions(db, webauthn, me.id, { rp, now });
    if (out === 'hidden') return empty(403);
    return out === 'full' ? json({ error: 'full' }, 409) : json(out);
  }
  if (method === 'POST' && parts.length === 1) {
    if (await overLimit(db, `pv:${who}`, 30, 3_600_000, now)) return empty(429);
    const { body, tooBig } = await readBody(request);
    if (tooBig) return empty(413);
    if (!body) return empty(400);
    const out = await register(db, webauthn, me.id, body, { rp, now });
    if (out === 'hidden') return empty(403);
    return out === 'ok' ? empty(204) : json({ error: out }, 400);
  }
  if (method === 'DELETE' && parts.length === 2 && isPasskeyId(parts[1])) return empty(await removePasskey(db, me.id, parts[1]) ? 204 : 404);
  return empty(404);
}
