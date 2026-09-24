// Someone's list on Archive.org (archive.org/details/@name/lists/1), as the site shows it. Archive.org
// only lets its own pages read lists, so /api/archive-list fetches it and passes this summary on.
// Nothing is stored: every request asks Archive.org.
import { isTakenDown } from '../src/services/policy.js';
const USER = /^[A-Za-z0-9._-]{1,64}$/;
const ID = /^[A-Za-z0-9._-]{1,200}$/;

export const listUrl = (user, id) => `https://archive.org/services/users/@${user}/lists${id ? `/${id}` : ''}`;
export const validRequest = (user, id) => USER.test(String(user || '')) && /^\d{1,6}$/.test(String(id || ''));
export const validUser = (user) => USER.test(String(user || ''));

// Archive.org's answer -> { name, description, identifiers }, or null for a missing or private list
export function summarize(answer) {
  const list = answer?.success && answer.value;
  if (!list || list.is_private) return null;
  // A taken-down upload (src/services/policy.js) is left out of someone's list shown here too
  const identifiers = (list.members || []).map(m => m?.identifier).filter(id => ID.test(String(id || '')) && !isTakenDown(id));
  return {
    name: String(list.list_name || 'A list').slice(0, 200),
    description: String(list.description || '').slice(0, 2000),
    identifiers: [...new Set(identifiers)].slice(0, 500),
  };
}

// All of someone's lists (archive.org/details/@name) -> [{ id, name, count }], public ones only
export function summarizeLists(answer) {
  if (!answer?.success || !Array.isArray(answer.value)) return null;
  return answer.value.filter(list => list && !list.is_private && /^\d{1,6}$/.test(String(list.id))).slice(0, 100).map(list => ({
    id: Number(list.id),
    name: String(list.list_name || 'A list').slice(0, 200),
    count: (list.members || []).filter(m => ID.test(String(m?.identifier || '')) && !isTakenDown(m.identifier)).length,
  }));
}
