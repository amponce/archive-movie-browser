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
  if (/^search(\.php)?$/.test(section || '')) {
    const query = (url.searchParams.get('query') || '').trim();
    return query ? { type: 'search', query } : null;
  }
  if (!['details', 'embed', 'download'].includes(section) || !IDENTIFIER.test(identifier || '')) return null;
  if (VIDEO_CATEGORIES.some(c => c.id === identifier)) return { type: 'collection', id: identifier };
  return { type: 'film', identifier };
}
