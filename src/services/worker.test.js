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
  for (const path of ['/c/AAAAAAAAAA', '/u/bad']) {
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
