// A dated record of changes to profiles and channels. The address a change came from is kept
// only as a tag: an HMAC of its network under NET_SALT, cut to 16 hex characters. Without a
// salt of at least 16 characters there is no tag.
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

// The network an address belongs to: an IPv4 address itself, the /64 prefix of an IPv6 one
export function networkOf(ip) {
  const text = String(ip).trim().toLowerCase().replace(/%.*$/, '');
  if (!text.includes(':')) return text;
  const mapped = text.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  const groups = part => (part ? part.split(':') : []).flatMap(g => (g.includes('.') ? ['0', '0'] : [g]));
  const [head, tail] = text.split('::');
  const all = tail === undefined ? groups(head) : [...groups(head), ...Array(Math.max(0, 8 - groups(head).length - groups(tail).length)).fill('0'), ...groups(tail)];
  return `${all.slice(0, 4).map(g => g.padStart(4, '0')).join(':')}::/64`;
}

export async function netTag(ip, salt) {
  if (!ip || typeof salt !== 'string' || salt.length < 16) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(networkOf(ip))))).slice(0, 16);
}

// Detail is JSON of at most 8 KB; a long film list (and its notes) is cut, and `more` says by how many
export const DETAIL_MAX = 8192;
const size = text => new TextEncoder().encode(text).length;
export function detailText(detail) {
  if (detail == null) return null;
  const films = Array.isArray(detail.films) ? detail.films : [];
  let keep = films.length;
  let text = JSON.stringify(detail);
  while (size(text) > DETAIL_MAX && keep > 0) {
    keep = Math.floor(keep / 2);
    const cut = { ...detail, films: films.slice(0, keep), more: films.length - keep };
    if (Array.isArray(detail.notes)) cut.notes = detail.notes.slice(0, keep);
    text = JSON.stringify(cut);
  }
  return size(text) <= DETAIL_MAX ? text : null;
}

// One row, from what `build` returns (nothing for null). A failure anywhere here, the reads
// that build the row included, never fails the change it records.
export async function record(db, build, { at, ip, salt }) {
  try {
    const entry = await build();
    if (!entry) return;
    const { kind, profileId = null, channelId = null, detail = null } = entry;
    await db.prepare('INSERT INTO history (at, kind, profile_id, channel_id, net, detail) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(at, kind, profileId, channelId, await netTag(ip, salt), detailText(detail)).run();
  } catch (error) {
    console.error('history:', error.message);
  }
}

// A channel's name, description, film ids and notes (aligned with the films)
export async function channelSnapshot(db, id) {
  const c = await db.prepare('SELECT name, description FROM channels WHERE id = ?').bind(id).first();
  if (!c) return null;
  const films = (await db.prepare('SELECT film_id, note FROM channel_films WHERE channel_id = ? ORDER BY position').bind(id).all()).results;
  return { name: c.name, description: c.description, films: films.map(f => f.film_id), notes: films.map(f => f.note) };
}

// The fields of `after` that differ from `before`; when the films or notes changed, the film
// ids, and the notes too if they changed
export function channelChanges(before, after) {
  const out = {};
  if (before.name !== after.name) out.name = after.name;
  if (before.description !== after.description) out.description = after.description;
  const notesChanged = JSON.stringify(before.notes) !== JSON.stringify(after.notes);
  if (notesChanged || JSON.stringify(before.films) !== JSON.stringify(after.films)) out.films = after.films;
  if (notesChanged) out.notes = after.notes;
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
