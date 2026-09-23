import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
const pageRewrites = config.rewrites.filter(route => route.destination === '/index.html')

for (const page of ['mcp', 'stats', 'tv', 'browse', 'lists']) {
  test(`${page} serves the SPA with or without a trailing slash`, () => {
    for (const path of [`/${page}`, `/${page}/`]) {
      assert.ok(pageRewrites.some(route => new RegExp(`^${route.source}$`).test(path)), path)
    }
    for (const path of [`/${page}/missing`, `/${page}-missing`]) {
      assert.ok(!pageRewrites.some(route => new RegExp(`^${route.source}$`).test(path)), path)
    }
  })
}
