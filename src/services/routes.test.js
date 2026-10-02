import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { route } from '../../api/_routes.js'
import { LIST_FILES } from '../../api/_lists.js'

// wrangler.jsonc is JSON with comments: drop whole-line comments and parse the rest
const config = JSON.parse(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''))

test('pages the server does not answer serve the SPA, which routes them itself', () => {
  assert.equal(config.assets.not_found_handling, 'single-page-application')
  assert.deepEqual(config.assets.run_worker_first, ['/api/*', '/sitemap.xml'])
})

test('the short TV addresses reach /api/tv with the right query', () => {
  assert.deepEqual(route('/api/tv/playlist.m3u'), { name: 'tv', query: { format: 'm3u' } })
  assert.deepEqual(route('/api/tv/guide.xml'), { name: 'tv', query: { format: 'xml' } })
  assert.deepEqual(route('/api/tv/channels.m3u'), { name: 'tv', query: { format: 'channels' } })
  assert.deepEqual(route('/api/tv/films.m3u'), { name: 'tv', query: { format: 'films' } })
  assert.deepEqual(route('/api/tv/library.zip'), { name: 'tv', query: { format: 'library' } })
  assert.deepEqual(route('/api/tv/live/3'), { name: 'tv', query: { live: '3' } })
  assert.deepEqual(route('/api/tv/film/Detour'), { name: 'tv', query: { film: 'Detour' } })
  assert.deepEqual(route('/sitemap.xml'), { name: 'sitemap', query: {} })
  assert.deepEqual(route('/api/mcp'), { name: 'mcp', query: {} })
  for (const path of ['/api/tv/nope', '/api/_stats', '/api/missing', '/api/tv/live/a/b']) assert.equal(route(path), null, path)
})

test('every list file is imported for the server (add its line to api/_lists.js)', () => {
  const dir = new URL('../lists/', import.meta.url)
  const slugs = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8')).slug).sort()
  assert.deepEqual(LIST_FILES.map(list => list.slug).sort(), slugs)
})

test('community addresses go to one handler', () => {
  for (const p of ['/api/profile', '/api/profile/abcdefghij/favourites/Detour', '/api/channel/abcdefghij/submit', '/api/channels']) assert.equal(route(p).name, 'community')
})
