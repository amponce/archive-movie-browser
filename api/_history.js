// A dated record of changes to profiles and channels. The address a change came from is kept
// only as a tag: an HMAC of it under NET_SALT, cut to 16 hex characters. Without a salt of at
// least 16 characters there is no tag.
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

export async function netTag(ip, salt) {
  if (!ip || typeof salt !== 'string' || salt.length < 16) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip)))).slice(0, 16);
}

// Detail is JSON of at most 8 KB; a long film list is cut, and `more` says by how many
export const DETAIL_MAX = 8192;
const size = text => new TextEncoder().encode(text).length;
export function detailText(detail) {
  if (detail == null) return null;
  const films = Array.isArray(detail.films) ? detail.films : [];
  let keep = films.length;
  let text = JSON.stringify(detail);
  while (size(text) > DETAIL_MAX && keep > 0) {
    keep = Math.floor(keep / 2);
    text = JSON.stringify({ ...detail, films: films.slice(0, keep), more: films.length - keep });
  }
  return size(text) <= DETAIL_MAX ? text : null;
}

// One row; a failure here never fails the change it records
export async function record(db, { at, kind, profileId = null, channelId = null, net = null, detail = null }) {
  try {
    await db.prepare('INSERT INTO history (at, kind, profile_id, channel_id, net, detail) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(at, kind, profileId, channelId, net, detailText(detail)).run();
  } catch (error) {
    console.error('history:', error.message);
  }
}

// A channel's name, description and film ids, for what an edit changed
export async function channelSnapshot(db, id) {
  const c = await db.prepare('SELECT name, description FROM channels WHERE id = ?').bind(id).first();
  if (!c) return null;
  const films = (await db.prepare('SELECT film_id, note FROM channel_films WHERE channel_id = ? ORDER BY position').bind(id).all()).results;
  return { name: c.name, description: c.description, films: films.map(f => f.film_id), notes: films.map(f => f.note) };
}

// The fields of `after` that differ from `before`; films as the id list when the films or notes changed
export function channelChanges(before, after) {
  const out = {};
  if (before.name !== after.name) out.name = after.name;
  if (before.description !== after.description) out.description = after.description;
  if (JSON.stringify([before.films, before.notes]) !== JSON.stringify([after.films, after.notes])) out.films = after.films;
  return out;
}

// A profile's display name, Archive.org username and handle where they changed
export function profileChanges(before, after) {
  const out = {};
  for (const [field, column] of [['name', 'name'], ['archiveUser', 'archive_user'], ['handle', 'handle']]) {
    if ((before[column] ?? null) !== (after[column] ?? null)) out[field] = after[column] ?? null;
  }
  return out;
}

export const snapshotDetail = ({ name, description, films }) => ({ name, description, films });
