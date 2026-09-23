// Turns a pasted Archive.org link into what it points at, so it can be opened in this app.
// Anything that is not clearly an archive.org link returns null and stays ordinary search text.
import { VIDEO_CATEGORIES } from './archive.js';

const IDENTIFIER = /^[A-Za-z0-9._-]{1,200}$/;

export function parseArchiveUrl(text) {
  const trimmed = String(text || '').trim();
  if (!/^(https?:\/\/)?(www\.)?archive\.org\//i.test(trimmed)) return null;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const [section, identifier] = url.pathname.split('/').filter(Boolean);
  const list = listFromPath(url.pathname);
  if (list) return list;
  if (/^search(\.php)?$/.test(section || '')) {
    const query = (url.searchParams.get('query') || '').trim();
    return query ? { type: 'search', query } : null;
  }
  if (!['details', 'embed', 'download'].includes(section) || !IDENTIFIER.test(identifier || '')) return null;
  if (VIDEO_CATEGORIES.some(c => c.id === identifier)) return { type: 'collection', id: identifier };
  // .../hexziasmovies/Annabelle+Comes+Home.mp4: one file inside the upload ('+' is a space there)
  const rest = url.pathname.split('/').filter(Boolean).slice(2).join('/');
  const file = rest && safeDecode(rest.replace(/\+/g, ' '));
  return file ? { type: 'film', identifier, file } : { type: 'film', identifier };
}

// /details/@someone/lists/1/any-name: a list someone keeps on Archive.org
const USER = /^[A-Za-z0-9._-]{1,64}$/;
function listFromPath(pathname) {
  const [section, user, lists, id] = pathname.split('/').filter(Boolean);
  if (section !== 'details' || !user?.startsWith('@') || lists !== 'lists') return null;
  const name = user.slice(1);
  return USER.test(name) && /^\d{1,6}$/.test(id || '') ? { type: 'list', user: name, id: Number(id) } : null;
}

// The same path on this site: orphanedfilms.com/details/... is archive.org/details/... opened here
export function parseSitePath(pathname) {
  if (!pathname.startsWith('/details/')) return null;
  return listFromPath(pathname) || parseArchiveUrl(`https://archive.org${pathname}`);
}

const safeDecode = (text) => { try { return decodeURIComponent(text); } catch { return text; } };

// Where a link leads on this site. A file inside an upload rides in the hash: #upload/file name
export function pathFor(link) {
  if (link.type === 'film') return `/browse#${encodeURIComponent(link.identifier)}${link.file ? `/${encodeURIComponent(link.file)}` : ''}`;
  if (link.type === 'list') return `/details/@${link.user}/lists/${link.id}`;
  // A collection opens on all its films, unless it stands for a genre (Film_Noir opens that pill)
  if (link.type === 'collection') return `/browse?collection=${encodeURIComponent(link.id)}${VIDEO_CATEGORIES.some(c => c.id === link.id && c.asGenre) ? '' : '&genre=all'}`;
  return `/browse?q=${encodeURIComponent(link.query)}`;
}

// An Archive.org address opened on this site (orphanedfilms.com/details/...), or a pasted link
// that arrived as search text (/browse?q=https://archive.org/...): where it should really go.
// null when the address is already the right one.
export function redirectFor(pathname, search = '') {
  const link = parseSitePath(pathname);
  if (link) return link.type === 'list' ? null : pathFor(link);
  const q = new URLSearchParams(search).get('q');
  const pasted = q && parseArchiveUrl(q);
  return pasted ? pathFor(pasted) : null;
}

// The film a /browse#... hash opens: '#upload' or '#upload/file name'
export function filmFromHash(hash) {
  const text = String(hash || '').replace(/^#/, '');
  if (!text) return null;
  const [identifier, ...file] = text.split('/');
  return { identifier: safeDecode(identifier), file: file.length ? safeDecode(file.join('/')) : null };
}
