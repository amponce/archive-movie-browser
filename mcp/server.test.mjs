// Starts the real server over stdio and talks to it like a client would.
// Archive.org is stubbed out for the offline checks; one live check is skipped unless LIVE=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { describe, browseFilms, searchFilms } from './tools.mjs';
import archiveService from '../src/services/archive.js';
import { loadPosterIndex, setPosterIndex } from '../src/services/posterIndex.js';

async function connect(t) {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: 'node', args: [fileURLToPath(new URL('./server.mjs', import.meta.url))] }));
  t.after(() => client.close());
  return client;
}

test('the server lists its four tools', async t => {
  const client = await connect(t);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['browse_films', 'get_film', 'list_collections', 'search_films', 'whats_on']);
  assert.ok(tools.every(tool => tool.description && tool.inputSchema));
});

test('list_collections answers without touching the network', async t => {
  const client = await connect(t);
  const result = await client.callTool({ name: 'list_collections', arguments: {} });
  const data = JSON.parse(result.content[0].text);
  assert.ok(data.collections.some(c => c.id === 'feature_films' && c.films));
  assert.ok(data.genres.includes('Horror'));
});

test('bad input is rejected before it reaches Archive.org', async t => {
  const client = await connect(t);
  const result = await client.callTool({ name: 'get_film', arguments: { identifier: '../../etc/passwd' } }).catch(error => ({ isError: true, error }));
  assert.ok(result.isError);
});

test('an indexed upload is described as the real film, with a poster and links', async () => {
  const film = await describe({ identifier: 'Cops1922', title: 'Cops1922', year: 2010, genres: ['Comedy'], runtimeMinutes: 18,
    archiveUrl: 'https://archive.org/details/Cops1922', embedUrl: 'https://archive.org/embed/Cops1922' });
  assert.equal(film.title, 'Cops');
  assert.equal(film.year, 1922);
  assert.match(film.posterUrl, /^https:\/\/image\.tmdb\.org\/t\/p\/w500\//);
  assert.equal(film.watchUrl, 'https://www.orphanedfilms.com/browse#Cops1922');
  assert.equal(Object.keys(film)[0], 'watchUrl', 'the link to give people comes first');
  assert.deepEqual(Object.keys(film).slice(0, 2), ['watchUrl', 'sourceUrl'], 'ours first, then the original Archive.org page');
  assert.equal(film.sourceUrl, 'https://archive.org/details/Cops1922');
});

test('live: search finds Night of the Living Dead', { skip: !process.env.LIVE }, async t => {
  const client = await connect(t);
  const result = await client.callTool({ name: 'search_films', arguments: { query: 'night living dead', limit: 3 } });
  assert.ok(!result.isError, result.content[0].text);
  assert.match(JSON.parse(result.content[0].text).films[0].title, /night of the living dead/i);
});

test('genre browse uses indexed films, upload lengths and one copy per film', async t => {
  const previous = await loadPosterIndex();
  t.after(() => setPosterIndex(previous));
  const entry = { i: 1, t: 'Eighties comedy', y: 1985, g: ['Comedy'], d: 90, p: '/poster.jpg', k: 40, c: 0.8 };
  setPosterIndex({
    comedy: entry,
    comedy_copy: { ...entry, c: 0.7 },
    comedy_trailer: { ...entry, d: 1, c: 0.99 },
    second: { ...entry, i: 2, t: 'Another comedy', d: 80, k: 10 },
    wrong_decade: { ...entry, i: 3, y: 1970 },
    wrong_genre: { ...entry, i: 4, g: ['Horror'] },
    short: { ...entry, i: 5, d: 20 },
  });
  const fetch = t.mock.method(archiveService, 'fetchFiltered', async () => ({ movies: [], total: 0 }));
  const result = await browseFilms({ collection: 'all', genre: 'Comedy', decade: 1980, limit: 1 });
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(result.total, 2, 'total precedes the result limit and counts films, not uploads');
  assert.deepEqual(result.films, [{
    watchUrl: 'https://www.orphanedfilms.com/browse#comedy',
    sourceUrl: 'https://archive.org/details/comedy',
    title: 'Eighties comedy', uploadTitle: 'Eighties comedy', year: 1985,
    runtimeMinutes: 90, genres: ['Comedy'], downloads: null, identifier: 'comedy',
    posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg', tmdbId: 1,
  }]);
  const sorted = await browseFilms({ collection: 'all', genre: 'Comedy', decade: 1980, sort: 'title asc' });
  assert.deepEqual(sorted.films.map(f => f.identifier), ['second', 'comedy']);
  const long = await browseFilms({ collection: 'all', genre: 'Comedy', decade: 1980, minRuntime: 85 });
  assert.deepEqual(long.films.map(f => f.identifier), ['comedy']);
});

test('unfiltered browse, collection browse, recent uploads and search still use Archive.org', async t => {
  const fetch = t.mock.method(archiveService, 'fetchFiltered', async () => ({ movies: [], total: 0 }));
  for (const args of [{ collection: 'all' }, { genre: 'Comedy' },
    { collection: 'all', genre: 'Comedy', sort: 'publicdate desc' }]) {
    await browseFilms(args);
  }
  await searchFilms({ query: 'Comedy' });
  assert.equal(fetch.mock.callCount(), 4);
  assert.equal(fetch.mock.calls[2].arguments[0].sortBy, 'publicdate');
  assert.equal(fetch.mock.calls[3].arguments[0].searchQuery, 'Comedy');
  const previous = await loadPosterIndex();
  t.after(() => setPosterIndex(previous));
  setPosterIndex({});
  await browseFilms({ collection: 'all', genre: 'Film Noir' });
  assert.equal(fetch.mock.callCount(), 5, 'an empty index result falls back like the site');
});

test('whats_on answers for every channel and for one, from the committed lineups', async () => {
  const { whatsOn } = await import('./tools.mjs');
  const all = await whatsOn();
  assert.ok(all.channels.length >= 25, `${all.channels.length} channels`);
  assert.ok(all.channels.every(c => c.now && c.now.title && c.tuneInUrl.includes('/tv#')));
  const one = await whatsOn({ channel: 1 });
  assert.equal(one.channels.length, 1);
  assert.equal(one.channels[0].number, 1);
  assert.equal((await whatsOn({ channel: 999 })).channels.length, 0);
});
