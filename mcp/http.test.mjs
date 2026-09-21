// The hosted endpoint (../api/mcp.js), served locally and called over real HTTP by an MCP client
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Readable } from 'node:stream';
import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { handle, REQUESTS_PER_MINUTE } from '../api/mcp.js';

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
  assert.deepEqual(tools.map(tool => tool.name).sort(), ['browse_films', 'get_film', 'list_collections', 'search_films']);
  const result = await client.callTool({ name: 'list_collections', arguments: {} });
  assert.ok(JSON.parse(result.content[0].text).decades.includes(1980));
});

test('browsers may call it (CORS), and one address cannot flood it', async t => {
  const url = await serve(t);
  const preflight = await fetch(url, { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  const ping = () => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-forwarded-for': '203.0.113.9' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
  let last;
  for (let i = 0; i <= REQUESTS_PER_MINUTE; i++) last = await ping();
  assert.equal(last.status, 429);
  assert.equal(last.headers.get('retry-after'), '60');
});
