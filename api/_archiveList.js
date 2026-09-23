// Someone's list on Archive.org (archive.org/details/@name/lists/1), as the site shows it. Archive.org
// only lets its own pages read lists, so /api/archive-list fetches it and passes this summary on.
// Nothing is stored: every request asks Archive.org.
const USER = /^[A-Za-z0-9._-]{1,64}$/;
const ID = /^[A-Za-z0-9._-]{1,200}$/;

export const listUrl = (user, id) => `https://archive.org/services/users/@${user}/lists/${id}`;
export const validRequest = (user, id) => USER.test(String(user || '')) && /^\d{1,6}$/.test(String(id || ''));

// Archive.org's answer -> { name, description, identifiers }, or null for a missing or private list
export function summarize(answer) {
  const list = answer?.success && answer.value;
  if (!list || list.is_private) return null;
  const identifiers = (list.members || []).map(m => m?.identifier).filter(id => ID.test(String(id || '')));
  return {
    name: String(list.list_name || 'A list').slice(0, 200),
    description: String(list.description || '').slice(0, 2000),
    identifiers: [...new Set(identifiers)].slice(0, 500),
  };
}
