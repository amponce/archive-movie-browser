import test from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_VERSION } from './tmdb.js';

let moduleId = 0;
async function makeService(t, stored = null) {
  const storage = new Map(stored ? [['tmdb-poster-cache', stored]] : []);
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } });
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { default: service, MIN_REQUEST_INTERVAL } = await import(`./tmdb.js?test=${++moduleId}`);
  service.setApiKey('test-key');
  return { service, storage, interval: MIN_REQUEST_INTERVAL };
}

test('movie details use the configured key and throttle, share in-flight work, and persist in cache', async t => {
  const { service, storage } = await makeService(t);
  const details = { title: 'Example', credits: { cast: [], crew: [] } };
  let finish;
  const fetchMock = t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finish = resolve; }));
  // The real throttle is exercised; only its network request is controlled.
  const throttle = t.mock.method(service, 'throttledFetch');
  const first = service.getMovieDetails(42);
  const second = service.getMovieDetails(42);
  assert.equal(fetchMock.mock.callCount(), 1);
  const url = new URL(fetchMock.mock.calls[0].arguments[0]);
  assert.equal(url.pathname, '/3/movie/42');
  assert.equal(url.searchParams.get('api_key'), 'test-key');
  assert.equal(url.searchParams.get('append_to_response'), 'credits');
  finish({ ok: true, json: async () => details });
  assert.deepEqual(await Promise.all([first, second]), [details, details]);
  assert.deepEqual(await service.getMovieDetails(42), details);
  assert.equal(throttle.mock.callCount(), 1);
  t.mock.timers.tick(2000);
  assert.ok([...Object.values(JSON.parse(storage.get('tmdb-poster-cache')).data)]
    .some(entry => entry.data.title === 'Example'));
});

test('movie details restore persisted data and refetch expired entries', async t => {
  const timestamp = Date.now();
  const cached = { id: 43, title: 'Cached' };
  const { service } = await makeService(t, JSON.stringify({
    version: CACHE_VERSION, timestamp, data: { 'details:43': { data: cached, timestamp } }
  }));
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => ({
    ok: true, json: async () => ({ id: 43, title: 'Fresh' })
  }));
  assert.deepEqual(await service.getMovieDetails(43), cached);
  assert.equal(fetchMock.mock.callCount(), 0);
  t.mock.method(Date, 'now', () => timestamp + 8 * 24 * 60 * 60 * 1000);
  assert.equal((await service.getMovieDetails(43)).title, 'Fresh');
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('failed movie details can be retried and a disabled service makes no request', async t => {
  const { service } = await makeService(t);
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  let now = Date.now();
  t.mock.method(Date, 'now', () => { now += 100; return now; });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  assert.equal(await service.getMovieDetails(44), null);
  fetchMock.mock.mockImplementation(async () => { throw new Error('offline'); });
  assert.equal(await service.getMovieDetails(44), null);
  fetchMock.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ id: 44 }) }));
  assert.deepEqual(await service.getMovieDetails(44), { credits: { cast: [], crew: [] } });
  assert.equal(fetchMock.mock.callCount(), 3);
  service.setApiKey('');
  assert.equal(await service.getMovieDetails(45), null);
  assert.equal(fetchMock.mock.callCount(), 3);
});

test('profile and backdrop URLs preserve image sizes and handle missing paths', async t => {
  const { service } = await makeService(t);
  assert.equal(service.getProfileUrl('/actor.jpg'), 'https://image.tmdb.org/t/p/w92/actor.jpg');
  assert.equal(service.getProfileUrl('/actor.jpg', 'w185'), 'https://image.tmdb.org/t/p/w185/actor.jpg');
  assert.equal(service.getProfileUrl(null), null);
  assert.equal(service.getBackdropUrl('/scene.jpg', 'w1280'), 'https://image.tmdb.org/t/p/w1280/scene.jpg');
});

test('an exact cleaned title wins over an earlier short substring result', async t => {
  const { service } = await makeService(t);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ results: [
    { id: 1, title: 'M', poster_path: '/wrong.jpg' },
    { id: 2, title: 'The Last Man', poster_path: '/correct.jpg' },
  ] }) }));
  assert.equal((await service.searchMovie('The Last Man (1964)', 1964)).id, 2);
});

test('movie details persist only displayed fields, six cast members and the director', async t => {
  const { service, storage } = await makeService(t);
  const displayed = {
    title: 'Example Film', tagline: 'An example', overview: 'A test story',
    release_date: '1959-01-01', original_language: 'en', budget: 100000,
    vote_average: 7, runtime: 90, backdrop_path: '/scene.jpg',
    genres: [{ id: 1, name: 'Drama' }],
  };
  const cast = Array.from({ length: 12 }, (_, id) => ({ id, name: `Actor ${id}` }));
  const director = { id: 20, name: 'Example Director', job: 'Director' };
  const response = {
    ...displayed, id: 46, revenue: 1000000, production_companies: [{ name: 'Unused' }],
    similar: { results: [{ id: 47 }] }, recommendations: { results: [{ id: 48 }] },
    credits: { cast, crew: [{ name: 'Composer', job: 'Composer' }, director] },
  };
  const original = structuredClone(response);
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => response }));
  const expected = { ...displayed, credits: { cast: cast.slice(0, 6), crew: [director] } };
  assert.deepEqual(await service.getMovieDetails(46), expected);
  assert.deepEqual(await service.getMovieDetails(46), expected);
  assert.equal(fetchMock.mock.callCount(), 1);
  t.mock.timers.tick(2000);
  const persisted = JSON.parse(storage.get('tmdb-poster-cache')).data['details:46'].data;
  assert.deepEqual(persisted, expected);
  assert.equal('similar' in persisted, false);
  assert.equal('recommendations' in persisted, false);
  assert.equal(persisted.credits.cast.length, 6);
  assert.deepEqual(response, original);
});

test('concurrent requests reserve distinct start times even while earlier responses are pending', async t => {
  const { service, interval } = await makeService(t);
  let now = 10000;
  t.mock.method(Date, 'now', () => now);
  const starts = [];
  const finish = [];
  t.mock.method(globalThis, 'fetch', url => {
    starts.push({ url, time: now });
    return new Promise(resolve => finish.push(resolve));
  });
  const requests = Array.from({ length: 24 }, (_, i) => service.throttledFetch(`movie-${i}`));
  assert.deepEqual(starts, [{ url: 'movie-0', time: 10000 }]);
  for (let i = 1; i < 24; i++) {
    now += interval - 1;
    t.mock.timers.tick(interval - 1);
    await Promise.resolve();
    assert.equal(starts.length, i);
    now += 1;
    t.mock.timers.tick(1);
    await Promise.resolve();
    assert.equal(starts.length, i + 1);
    assert.deepEqual(starts[i], { url: `movie-${i}`, time: 10000 + i * interval });
  }
  finish.forEach(resolve => resolve({ ok: true }));
  await Promise.all(requests);
});

test('a failed request does not block later slots and an idle request starts immediately', async t => {
  const { service, interval } = await makeService(t);
  let now = 10000;
  t.mock.method(Date, 'now', () => now);
  const starts = [];
  t.mock.method(globalThis, 'fetch', async url => {
    starts.push(now);
    if (url === 'fail') throw new Error('offline');
    return { ok: true };
  });
  const failure = assert.rejects(service.throttledFetch('fail'), /offline/);
  const next = service.throttledFetch('next');
  now += interval;
  t.mock.timers.tick(interval);
  await Promise.all([failure, next]);
  now += 5 * interval;
  await service.throttledFetch('idle');
  assert.deepEqual(starts, [10000, 10000 + interval, 10000 + 6 * interval]);
});

test('searchMovie answers from the poster index without calling TMDB, even with no API key', async t => {
  const { service } = await makeService(t);
  const { setPosterIndex } = await import('./posterIndex.js');
  setPosterIndex({ indexed_film: { i: 7, t: 'Indexed Film', y: 1950, p: '/i.jpg', v: 6, c: 0.9 }, indexed_none: { n: 1, c: 0.9 } });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ results: [] }) }));
  service.setApiKey('');
  assert.equal((await service.searchMovie('Whatever_upload_title', null, 'indexed_film')).posterPath, '/i.jpg');
  assert.equal(await service.searchMovie('Whatever', null, 'indexed_none'), null);
  assert.equal(await service.searchMovie('Whatever', null, 'not_indexed'), null, 'no key and not indexed: nothing to show');
  assert.equal(fetchMock.mock.callCount(), 0);
  setPosterIndex({});
});

test('cache expiry is per entry even when the old envelope timestamp expired', async t => {
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const { service, storage } = await makeService(t, JSON.stringify({
    version: CACHE_VERSION, timestamp: now - 2 * week, data: {
      'fresh-unknown': { data: { id: 1 }, timestamp: now },
      'old-unknown': { data: { id: 2 }, timestamp: now - week - 1 },
      'miss-unknown': { data: null, timestamp: now },
      genres: { data: { 27: 'Horror' }, timestamp: now - 2 * week }
    }
  }));
  assert.equal(service.getFromCache('fresh').found, true);
  assert.deepEqual(service.getFromCache('miss'), { found: true, data: null });
  assert.equal(service.getFromCache('old').found, false);
  assert.deepEqual(await service.getGenres(), { 27: 'Horror' });
  service.setCache('new', null, { id: 3 });
  t.mock.timers.tick(2000);
  const saved = JSON.parse(storage.get('tmdb-poster-cache'));
  assert.equal('old-unknown' in saved.data, false);
  assert.equal('timestamp' in saved, false);
});

test('cache restores and persists only the newest 2000 entries', async t => {
  const now = Date.now();
  const data = Object.fromEntries(Array.from({ length: 2003 }, (_, i) =>
    [`film${i}-unknown`, { data: { id: i }, timestamp: now - 2003 + i }]));
  const { service, storage } = await makeService(t, JSON.stringify({
    version: CACHE_VERSION, timestamp: now, data
  }));
  assert.equal(service.getFromCache('film2').found, false);
  assert.equal(service.getFromCache('film3').found, true);
  service.setCache('new', null, { id: 3000 });
  assert.equal(service.getFromCache('film3').found, false);
  t.mock.timers.tick(2000);
  assert.equal(Object.keys(JSON.parse(storage.get('tmdb-poster-cache')).data).length, 2000);
});

test('failed storage writes retain the last persisted cache', async t => {
  const stored = JSON.stringify({ version: CACHE_VERSION, timestamp: Date.now(), data: {} });
  const { service, storage } = await makeService(t, stored);
  t.mock.method(console, 'warn', () => {});
  t.mock.method(localStorage, 'setItem', () => { throw new Error('quota'); });
  service.setCache('new', null, null);
  t.mock.timers.tick(2000);
  assert.equal(storage.get('tmdb-poster-cache'), stored);
});

test('failed searches remain retryable while successful empty searches cache a miss', async t => {
  const { service } = await makeService(t);
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  const request = t.mock.method(service, 'throttledFetch', async () => ({ ok: false, status: 503 }));
  await service.searchMovie('Example');
  assert.equal(service.getFromCache('Example').found, false);
  request.mock.mockImplementation(async () => { throw new Error('offline'); });
  await service.searchMovie('Example');
  assert.equal(service.getFromCache('Example').found, false);
  request.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ results: [] }) }));
  await service.searchMovie('Example');
  assert.deepEqual(service.getFromCache('Example'), { found: true, data: null });
  await service.searchMovie('Example');
  assert.equal(request.mock.callCount(), 3);
});
