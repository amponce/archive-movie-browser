// Starts the real server over stdio and talks to it like a client would.
// Archive.org is stubbed out for the offline checks; one live check is skipped unless LIVE=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createServer } from './register.mjs';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { describe } from './tools.mjs';

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

test('resources and movie_night are discoverable and readable over stdio', async t => {
  const client = await connect(t);
  assert.ok((await client.listResources()).resources.some(r => r.uri === 'archive://collections'));
  assert.ok((await client.listResourceTemplates()).resourceTemplates.some(r => r.uriTemplate === 'archive://film/{identifier}'));
  const resource = await client.readResource({ uri: 'archive://collections' });
  const tool = await client.callTool({ name: 'list_collections', arguments: {} });
  assert.equal(resource.contents[0].mimeType, 'application/json');
  assert.deepEqual(JSON.parse(resource.contents[0].text), JSON.parse(tool.content[0].text));
  const prompt = (await client.listPrompts()).prompts.find(p => p.name === 'movie_night');
  assert.deepEqual(prompt.arguments.map(a => a.name), ['mood', 'time']);
  const result = await client.getPrompt({ name: 'movie_night', arguments: { mood: 'comedy', time: '70 minutes' } });
  assert.equal(result.messages[0].role, 'user');
  for (const phrase of ['comedy', '70 minutes', 'browse_films', 'search_films', 'three distinct', 'watchUrl', 'sourceUrl']) {
    assert.ok(result.messages[0].content.text.includes(phrase), phrase);
  }
  const defaults = await client.getPrompt({ name: 'movie_night', arguments: {} });
  assert.match(defaults.messages[0].content.text, /no time limit specified/);
  await assert.rejects(client.getPrompt({ name: 'movie_night', arguments: { mood: 'a'.repeat(201) } }));
});

test('film resources reuse the wrapped handler, reject bad ids and propagate failures', async t => {
  const calls = [];
  const film = { title: 'Cops', identifier: 'Cops1922', watchUrl: 'https://www.orphanedfilms.com/browse#Cops1922' };
  const server = createServer({ wrap: (name, run) => async args => {
    if (name !== 'get_film') return run(args);
    calls.push(args);
    if (args.identifier === 'unavailable') throw new Error('Archive unavailable');
    return film;
  } });
  const client = new Client({ name: 'resource-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  const result = await client.readResource({ uri: 'archive://film/Cops1922' });
  assert.equal(result.contents[0].uri, 'archive://film/Cops1922');
  assert.deepEqual(JSON.parse(result.contents[0].text), film);
  assert.deepEqual(calls, [{ identifier: 'Cops1922' }]);
  await assert.rejects(client.readResource({ uri: 'archive://film/bad%2Fidentifier' }));
  assert.equal(calls.length, 1, 'invalid input must not reach the handler');
  await assert.rejects(client.readResource({ uri: 'archive://film/unavailable' }), /Archive unavailable/);
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
