import test from 'node:test';
import assert from 'node:assert/strict';

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
  const { default: service } = await import(`./tmdb.js?test=${++moduleId}`);
  service.setApiKey('test-key');
  return { service, storage };
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
    version: 1, timestamp, data: { 'details:43': { data: cached, timestamp } }
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
