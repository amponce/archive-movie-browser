// GET /sitemap.xml: the site's own pages for search engines, the lists read from src/lists so a new
// list is listed without anyone editing this. No film pages: films open under /browse#id.
import { readFileSync, readdirSync } from 'node:fs';
import { collectLists } from '../src/services/lists.js';

const SITE = 'https://www.orphanedfilms.com';
const PAGES = ['/', '/browse', '/tv', '/lists', '/iptv', '/mcp', '/from-archive', '/takedown'];

export function sitemap() {
  const dir = new URL('../src/lists/', import.meta.url);
  const lists = collectLists(readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8'))));
  const urls = [...PAGES, ...lists.map(list => `/lists/${list.slug}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(path => `  <url><loc>${SITE}${encodeURI(path)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.status(200).send(sitemap());
}
