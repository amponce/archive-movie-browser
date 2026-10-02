// The hosted endpoint (../api/mcp.js), served locally and called over real HTTP by an MCP client
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Readable } from 'node:stream';
import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { handle, REQUESTS_PER_MINUTE, limits } from '../api/mcp.js';
import archiveService from '../src/services/archive.js';

// A few lines of glue standing in for Vercel: Node request in, web Response out
function serve(t) {
  const server = http.createServer(async (req, res) => {
    const body = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Readable.toWeb(req);
    const response = await handle(new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, body, duplex: 'half' }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
  });
  return new Promise(resolve => server.listen(0, () => { t.after(() => server.close()); resolve(`http://localhost:${server.address().port}/api/mcp`); }));
}

test('an MCP client can list and call the tools over HTTP', async t => {
  const url = await serve(t);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  t.after(() => client.close());
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['browse_films', 'get_film', 'list_collections', 'search_films', 'whats_on']);
  const result = await client.callTool({ name: 'list_collections', arguments: {} });
  assert.ok(JSON.parse(result.content[0].text).decades.includes(1980));
  const collections = await client.readResource({ uri: 'archive://collections' });
  assert.deepEqual(JSON.parse(collections.contents[0].text), JSON.parse(result.content[0].text));
  assert.ok((await client.listResourceTemplates()).resourceTemplates.some(r => r.uriTemplate === 'archive://film/{identifier}'));
  assert.ok((await client.listPrompts()).prompts.some(p => p.name === 'movie_night'));
  const prompt = await client.getPrompt({ name: 'movie_night', arguments: { mood: 'noir', time: '70 minutes' } });
  assert.match(prompt.messages[0].content.text, /70 minutes/);
});

test('browsers may call it (CORS), and one address cannot flood it', async t => {
  const url = await serve(t);
  const preflight = await fetch(url, { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  const ping = () => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'cf-connecting-ip': '203.0.113.9' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
  let last;
  for (let i = 0; i <= REQUESTS_PER_MINUTE; i++) last = await ping();
  assert.equal(last.status, 429);
  assert.equal(last.headers.get('retry-after'), '60');
});

test('a request is always answered before Vercel would cut it off', async t => {
  const url = await serve(t);
  const saved = { ...limits };
  t.after(() => Object.assign(limits, saved));
  Object.assign(limits, { bodyMs: 200, answerMs: 300 });
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'cf-connecting-ip': '203.0.113.10' };

  // A body that never finishes arriving: an error, not a hang
  const stalled = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"jsonrpc":"2.0",')); } });
  const started = Date.now();
  const cut = await fetch(url, { method: 'POST', headers, body: stalled, duplex: 'half' });
  assert.equal(cut.status, 408);
  assert.ok(Date.now() - started < 2000);

  // A tool that takes too long: a JSON-RPC error with the request's id
  const realFetch = archiveService.fetchFiltered;
  archiveService.fetchFiltered = () => new Promise(() => {}); // Archive.org never answers
  t.after(() => { archiveService.fetchFiltered = realFetch; });
  const slow = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'search_films', arguments: { query: 'never answers' } } }) });
  const answer = await slow.json();
  assert.equal(answer.id, 7);
  assert.match(answer.error.message, /too long/);

  // And a normal call still gets its answer
  const list = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 8, method: 'tools/list' }) });
  assert.match(await list.text(), /search_films/);
});

test('subscriptions/listen is declined at once instead of holding a stream open', async t => {
  const url = await serve(t);
  const started = Date.now();
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'cf-connecting-ip': '203.0.113.11' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'subscriptions/listen', params: { notifications: { toolsListChanged: true } } }) });
  const answer = await response.json();
  assert.equal(answer.id, 3);
  assert.equal(answer.error.code, -32601);
  assert.ok(Date.now() - started < 2000);
});
