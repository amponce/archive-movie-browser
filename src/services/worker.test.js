import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';

test('the channel listing is cached under its bare path', async () => {
  const keys = [];
  const store = new Map();
  globalThis.caches = { default: {
    match: async (req) => { keys.push(['match', req.url]); return store.get(req.url)?.clone(); },
    put: async (req, res) => { keys.push(['put', req.url]); store.set(req.url, res); },
  } };
  const { default: worker } = await import('../../worker.js');
  const env = { DB: await openTestDb() };
  const waits = [];
  const ctx = { waitUntil: p => waits.push(p) };
  const first = await worker.fetch(new Request('https://www.orphanedfilms.com/api/channels?x=1'), env, ctx);
  await Promise.all(waits);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { channels: [] });
  assert.equal(first.headers.get('X-Content-Type-Options'), 'nosniff');
  const second = await worker.fetch(new Request('https://www.orphanedfilms.com/api/channels?y=2'), env, ctx);
  assert.equal(second.status, 200);
  assert.deepEqual(keys, [
    ['match', 'https://www.orphanedfilms.com/api/channels'],
    ['put', 'https://www.orphanedfilms.com/api/channels'],
    ['match', 'https://www.orphanedfilms.com/api/channels'],
  ]);
});

test('share pages carry an escaped preview and noindex unless listed', async () => {
  const { default: worker } = await import('../../worker.js');
  const { createProfile, createChannel } = await import('../../api/_community.js');
  const page = '<!doctype html><html><head><meta name="description" content="Site" /><meta property="og:title" content="Site" /><meta property="og:image" content="x.jpg" /><title>Orphaned Films: forgotten films, found</title></head><body><div id="root"></div></body></html>';
  const db = await openTestDb();
  const env = { DB: db, ASSETS: { fetch: async () => new Response(page, { headers: { 'Content-Type': 'text/html', ETag: '"abc"' } }) } };
  const get = path => worker.fetch(new Request(`https://www.orphanedfilms.com${path}`), env, { waitUntil() {} });
  const { id: owner } = await createProfile(db, { now: 1 });
  const name = '<script>alert(1)</script> & "x"';
  const id = await createChannel(db, owner, { name, description: '', films: [{ film: 'film-one' }] }, { now: 1, flag: async () => false });
  const escaped = '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot; | Orphaned Films';

  let res = await get(`/c/${id}`);
  let html = await res.text();
  assert.equal(res.status, 200);
  assert.ok(html.includes(`<meta property="og:title" content="${escaped}">`));
  assert.ok(html.includes(`<title>${escaped}</title>`));
  assert.ok(!html.includes('<script>alert'));
  assert.equal(html.match(/og:title/g).length, 1);
  assert.ok(!html.includes('og:image'));
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');

  await db.prepare("UPDATE channels SET status = 'public' WHERE id = ?").bind(id).run();
  res = await get(`/c/${id}`);
  html = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!html.includes('noindex'));
  assert.equal(res.headers.get('X-Robots-Tag'), null);

  res = await get(`/u/${owner}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');

  res = await get('/c/aaaaaaaaaa');
  html = await res.text();
  assert.equal(res.status, 404);
  assert.ok(html.includes('<div id="root">') && html.includes('noindex'));
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');

  res = await get(`/c/${id}/`);
  html = await res.text();
  assert.equal(res.status, 200);
  assert.ok(html.includes('og:title'));
  assert.ok(html.includes('name="description" content="1 film"'));
  assert.equal(res.headers.get('ETag'), null);
  assert.equal(html.match(/name="description"/g).length, 1);

  env.ASSETS = { fetch: async () => new Response('spa', { status: 200 }) };
  for (const path of ['/c/AAAAAAAAAA', '/u/b', '/c/not-an-id']) {
    res = await get(path);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'spa');
  }
  env.ASSETS = { fetch: async () => new Response(page, { headers: { 'Content-Type': 'text/html' } }) };

  env.DB = { prepare() { throw new Error('down'); } };
  res = await get(`/c/${id}`);
  html = await res.text();
  assert.equal(res.status, 200);
  assert.equal(html, page);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
});

test('share pages fetch the site shell and show the first poster', async () => {
  const { default: worker } = await import('../../worker.js');
  const { createProfile, createChannel, setFavourite } = await import('../../api/_community.js');
  const { default: posterIndex } = await import('../../public/poster-index.json', { with: { type: 'json' } });
  const { isTakenDown, isForbidden } = await import('./policy.js');
  const [withPoster, entry] = Object.entries(posterIndex.films).find(([id, e]) => e.p && /^[A-Za-z0-9._-]+$/.test(id) && !isTakenDown(id) && !isForbidden({ title: e.t }));
  const page = '<!doctype html><html><head><meta property="og:image" content="x.jpg" /><title>Orphaned Films</title></head><body></body></html>';
  const asked = [];
  const db = await openTestDb();
  const env = { DB: db, ASSETS: { fetch: async (request) => { asked.push(new URL(request.url).pathname); return new Response(page, { headers: { 'Content-Type': 'text/html' } }); } } };
  const get = path => worker.fetch(new Request(`https://www.orphanedfilms.com${path}`), env, { waitUntil() {} });
  const { id: owner } = await createProfile(db, { now: 1 });
  const id = await createChannel(db, owner, { name: 'Posters', films: [{ film: 'no-poster-here' }, { film: withPoster }] }, { now: 1, flag: async () => false });
  const image = `https://image.tmdb.org/t/p/w500${entry.p}`;

  let html = await (await get(`/c/${id}`)).text();
  assert.deepEqual(asked, ['/']);
  assert.ok(html.includes(`<meta property="og:image" content="${image}">`));
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
  assert.equal(html.match(/og:image/g).length, 1);

  html = await (await get(`/u/${owner}`)).text();
  assert.ok(!html.includes('og:image'), 'no favourites, no picture');
  assert.ok(html.includes('<meta name="twitter:card" content="summary">'));

  await setFavourite(db, owner, withPoster, true, { now: 2 });
  html = await (await get(`/u/${owner}`)).text();
  assert.ok(html.includes(`<meta property="og:image" content="${image}">`));
  assert.ok(html.includes('summary_large_image'));
});

test('a profile handle serves the share page, names itself canonical, and an old one redirects', async () => {
  const { default: worker } = await import('../../worker.js');
  const { createProfile, updateProfile } = await import('../../api/_community.js');
  const page = '<!doctype html><html><head><title>Orphaned Films</title></head><body><div id="root"></div></body></html>';
  const db = await openTestDb();
  const env = { DB: db, ASSETS: { fetch: async () => new Response(page, { headers: { 'Content-Type': 'text/html' } }) } };
  const get = path => worker.fetch(new Request(`https://www.orphanedfilms.com${path}`), env, { waitUntil() {} });
  const { id } = await createProfile(db, { now: Date.now() });
  await updateProfile(db, id, { name: 'Night Owl', handle: 'night-owl' }, { now: Date.now() });
  const canonical = '<link rel="canonical" href="https://www.orphanedfilms.com/u/night-owl">';

  for (const path of ['/u/night-owl', '/u/night-owl/', `/u/${id}`]) {
    const res = await get(path);
    const html = await res.text();
    assert.equal(res.status, 200, path);
    assert.ok(html.includes('<title>Night Owl | Orphaned Films</title>'), path);
    assert.ok(html.includes(canonical), path);
    assert.ok(html.includes('<meta name="robots" content="noindex">'), path);
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  }

  const upper = await get('/u/Night-Owl?x=1');
  assert.equal(upper.status, 308);
  assert.equal(upper.headers.get('Location'), 'https://www.orphanedfilms.com/u/night-owl?x=1');

  await updateProfile(db, id, { handle: 'owl' }, { now: Date.now() });
  let res = await get('/u/night-owl?x=1');
  assert.equal(res.status, 308);
  assert.equal(res.headers.get('Location'), 'https://www.orphanedfilms.com/u/owl?x=1');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  await updateProfile(db, id, { handle: null }, { now: Date.now() });
  res = await get('/u/owl');
  assert.equal(res.status, 308);
  assert.equal(res.headers.get('Location'), `https://www.orphanedfilms.com/u/${id}`);
  res = await get(`/u/${id}`);
  assert.ok(!(await res.text()).includes('canonical'));

  assert.equal((await get('/u/nobody-here')).status, 404);
  await updateProfile(db, id, { handle: 'owl' }, { now: Date.now() });
  await db.prepare('UPDATE profiles SET hidden = 1 WHERE id = ?').bind(id).run();
  for (const path of ['/u/owl', '/u/night-owl', `/u/${id}`]) assert.equal((await get(path)).status, 404, path);
});

test('handle lookups and profile reads are never cached', async () => {
  const seen = [];
  globalThis.caches = { default: { match: async (req) => { seen.push(req.url); }, put: async (req) => { seen.push(req.url); } } };
  const { default: worker } = await import('../../worker.js');
  const env = { DB: await openTestDb() };
  for (const path of ['/api/handle/night-owl', '/api/profile/night-owl']) {
    const res = await worker.fetch(new Request(`https://www.orphanedfilms.com${path}`, { headers: { 'cf-connecting-ip': '1.1.1.1' } }), env, { waitUntil() {} });
    assert.equal(res.headers.get('Cache-Control'), 'no-store', path);
  }
  assert.deepEqual(seen, []);
});

test('a film is looked up on Archive.org once per instance; a failed lookup is asked again', async () => {
  const { default: worker } = await import('../../worker.js');
  const env = { DB: await openTestDb() };
  const asked = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    if (String(url).includes('memo-down')) throw new Error('slow');
    return new Response(JSON.stringify({ result: { title: 'A film' } }), { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const site = 'https://www.orphanedfilms.com';
    const send = (method, path, body, auth) => worker.fetch(new Request(site + path, { method, body: body && JSON.stringify(body), headers: { origin: site, 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': '198.51.100.4', ...(auth && { authorization: `Bearer ${auth.id}.${auth.key}` }) } }), env, { waitUntil() {} });
    const me = await (await send('POST', '/api/profile')).json();
    const films = [{ film: 'memo-one' }, { film: 'memo-two' }, { film: 'memo-down' }];
    assert.equal((await send('POST', '/api/channel', { name: 'A', films }, me)).status, 201);
    assert.equal(asked.length, 3);
    assert.equal((await send('POST', '/api/channel', { name: 'B', films }, me)).status, 201);
    assert.deepEqual(asked.slice(3).map(u => u.includes('memo-down')), [true]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the IPTV playlist answers HEAD the way it answers GET, without a body', async () => {
  const { default: worker } = await import('../../worker.js');
  const ask = method => worker.fetch(new Request('https://www.orphanedfilms.com/api/tv/channels.m3u', { method }), {}, { waitUntil() {} });
  const get = await ask('GET');
  const head = await ask('HEAD');
  assert.equal(get.status, 200);
  assert.equal(head.status, 200, 'IPTV apps check a stream with HEAD before they play it');
  assert.equal(head.headers.get('Content-Type'), get.headers.get('Content-Type'));
  assert.equal(await head.text(), '');
  assert.equal((await ask('POST')).status, 405);
});
