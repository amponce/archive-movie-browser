// A few pages do not need a router: the path picks the page, and links between them are
// ordinary links. App.jsx maps each key to the page component.
import { HANDLE } from './handle.js';

const ID = /^[a-z2-7]{10}$/;
const PATHS = ['/', '/tv', '/mcp', '/stats', '/lists', '/takedown', '/from-archive', '/iptv', '/collection', '/details', '/channels'];

// '/lists/noir-you-can-finish-tonight' -> the lists page with that slug; '/c/<id>' -> the channel
// page with that id; '/u/<id>' and '/u/<handle>' -> the profile page with that id or handle.
// The front page is the programme; '/browse', and '/' with filters or a #film link from before
// the front page existed, is the film browser (null).
// ponytail: old '/?genre=' and '/#film' links keep rendering the browser at '/' instead of
// redirecting; once the MCP and shared links all say /browse, redirect and drop the case.
export function pageFor(pathname, search = '', hash = '') {
  const path = pathname.replace(/\/+$/, '');
  if (path === '' || path === '/browse') return search || (path === '' && hash.length > 1) || path ? null : { key: '/' };
  const list = path.match(/^\/lists\/([a-z0-9-]+)$/);
  if (list) return { key: '/lists', slug: list[1] };
  const own = path.match(/^\/(c|u)\/([a-z0-9_-]+)$/);
  if (own && (ID.test(own[2]) || (own[1] === 'u' && HANDLE.test(own[2])))) return { key: `/${own[1]}`, slug: own[2] };
  return PATHS.includes(path) ? { key: path } : null;
}
