// Curated lists: JSON files in src/lists, one per list, added by pull request (see the README
// there). The app bundles them with Vite (src/lists/index.js); this module is the rules and
// stays runnable in plain Node for the tests.
const IDENTIFIER = /^[A-Za-z0-9._-]{1,200}$/;

export function validateList(list) {
  const problems = [];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(list?.slug || '')) problems.push('slug must be lowercase letters, digits and dashes');
  if (!list?.title?.trim()) problems.push('title is required');
  if (!list?.blurb?.trim()) problems.push('blurb is required');
  if (!list?.curator?.trim()) problems.push('curator is required');
  if (!Array.isArray(list?.films) || list.films.length < 1 || list.films.length > 40) problems.push('films must have between 1 and 40 entries');
  else list.films.forEach((film, i) => {
    if (!IDENTIFIER.test(film?.id || '')) problems.push(`films[${i}].id is not an Archive.org identifier`);
    if (film?.note !== undefined && typeof film.note !== 'string') problems.push(`films[${i}].note must be a string`);
  });
  return problems;
}

// Valid lists only, alphabetical by title
export function collectLists(lists) {
  return lists.filter(list => validateList(list).length === 0).sort((a, b) => a.title.localeCompare(b.title));
}

export function listBySlug(lists, slug) {
  return lists.find(list => list.slug === slug) || null;
}
