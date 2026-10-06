// GET /sitemap.xml: the site's own pages for search engines, the lists from api/_lists.js and the
// listed community channels. No film pages: films open under /browse#id.
import { LISTS } from './_lists.js';
import { listChannels } from './_community.js';

const SITE = 'https://www.orphanedfilms.com';
const PAGES = ['/', '/browse', '/tv', '/lists', '/channels', '/iptv', '/mcp', '/from-archive', '/takedown', '/halloween'];

export async function listedChannelPaths(db) {
  if (!db) return [];
  try {
    return (await listChannels(db, { minutes: async () => ({}) })).map(c => `/c/${c.id}`);
  } catch {
    return [];
  }
}

export function sitemap(channelPaths = []) {
  const urls = [...PAGES, ...LISTS.map(list => `/lists/${list.slug}`), ...channelPaths];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(path => `  <url><loc>${SITE}${encodeURI(path)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

export default async function handler(req, res, env) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400');
  res.status(200).send(sitemap(await listedChannelPaths(env?.DB)));
}
