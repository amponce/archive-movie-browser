// Which handler in worker.js answers an address, and with what query. The short /api/tv/...
// addresses are the ones IPTV apps use.
const NAMES = ['archive-list', 'sitemap', 'subtitles', 'tmdb', 'tv', 'event', 'stats', 'mcp'];

const TV_PATHS = { 'playlist.m3u': { format: 'm3u' }, 'guide.xml': { format: 'xml' }, 'channels.m3u': { format: 'channels' }, 'films.m3u': { format: 'films' }, 'library.zip': { format: 'library' } };
export function route(pathname) {
  if (/^\/api\/(profile|channel|channels|passkey|handle)(\/|$)/.test(pathname)) return { name: 'community', query: {} };
  if (pathname === '/sitemap.xml') return { name: 'sitemap', query: {} };
  const tvPath = pathname.match(/^\/api\/tv\/(.+)$/)?.[1];
  if (tvPath) {
    if (TV_PATHS[tvPath]) return { name: 'tv', query: TV_PATHS[tvPath] };
    const [, kind, value] = tvPath.match(/^(live|film)\/([^/]+)$/) || [];
    return kind ? { name: 'tv', query: { [kind]: decodeURIComponent(value) } } : null;
  }
  const name = pathname.match(/^\/api\/([a-z-]+)\/?$/)?.[1];
  return NAMES.includes(name) ? { name, query: {} } : null;
}

