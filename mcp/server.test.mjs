// Starts the real server over stdio and talks to it like a client would.
// Archive.org is stubbed out for the offline checks; one live check is skipped unless LIVE=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { describe } from './tools.mjs';

async function connect(t) {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: 'node', args: [new URL('./server.mjs', import.meta.url).pathname] }));
  t.after(() => client.close());
  return client;
}

test('the server lists its four tools', async t => {
  const client = await connect(t);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['browse_films', 'get_film', 'list_collections', 'search_films']);
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
  assert.equal(film.watchUrl, 'https://archive-movie-browser.vercel.app/#Cops1922');
  assert.equal(Object.keys(film)[0], 'watchUrl', 'the link to give people comes first');
  assert.ok(!JSON.stringify(film).includes('archive.org/details'), 'list results carry one link: ours');
});

test('live: search finds Night of the Living Dead', { skip: !process.env.LIVE }, async t => {
  const client = await connect(t);
  const result = await client.callTool({ name: 'search_films', arguments: { query: 'night living dead', limit: 3 } });
  assert.ok(!result.isError, result.content[0].text);
  assert.match(JSON.parse(result.content[0].text).films[0].title, /night of the living dead/i);
});
