// Profiles, favourites and channels: rules and storage. `db` is a D1 database.
import { isTakenDown, isForbidden } from '../src/services/policy.js';
import { HANDLE, cleanHandle, handleVariants } from '../src/services/handle.js';
import posterIndex from '../public/poster-index.json' with { type: 'json' };

export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
export const LIMITS = { displayName: 40, name: 80, description: 500, note: 280, films: 40, channels: 50, favourites: 1000, minToSubmit: 5 };
export const FILM = /^[A-Za-z0-9._-]{1,200}$/;
export const ID = /^[a-z2-7]{10}$/;

const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
export const newId = () => [...crypto.getRandomValues(new Uint8Array(10))].map(b => ALPHABET[b & 31]).join('');
export const newKey = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const hashKey = async key => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(key)))));

// Control characters become spaces; invisible and direction-changing characters are dropped
// eslint-disable-next-line no-control-regex
export const cleanText = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/[\u115f\u1160\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\u2800\u3164\ufeff\uffa0]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
// The same for text with paragraphs (a description): line breaks stay, at most one blank line
export const cleanLines = (value, max) => String(value ?? '').split(/\r\n?|\n/).map(line => cleanText(line, max)).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

// A film is checked by its title from the index, or by its identifier read as words, so a
// check needs no Archive.org request
export const refused = film => isTakenDown(film) || isForbidden({ title: posterIndex.films[film]?.t || String(film).replace(/[_.-]+/g, ' ') });

export function cleanFilms(list) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const film = String(item?.film ?? '');
    if (!FILM.test(film) || seen.has(film) || refused(film)) continue;
    seen.add(film);
    out.push({ film, note: cleanText(item.note, LIMITS.note) });
    if (out.length === LIMITS.films) break;
  }
  return out;
}

export const isListed = status => status === 'public' || status === 'featured';
export const afterContentEdit = status => (isListed(status) ? 'submitted' : status);
export function submitProblem({ films, flagged, status }) {
  if (status === 'hidden') return 'hidden';
  if (films < LIMITS.minToSubmit) return 'too-few';
  if (flagged > 0) return 'flagged';
  return null;
}

export async function createProfile(db, { now }) {
  const id = newId();
  const key = newKey();
  await db.prepare('INSERT INTO profiles (id, key_hash, created, updated) VALUES (?, ?, ?, ?)').bind(id, await hashKey(key), now, now).run();
  return { id, key };
}

export async function authProfile(db, id, key) {
  if (!ID.test(String(id)) || !key) return null;
  const row = await db.prepare('SELECT * FROM profiles WHERE id = ? AND hidden = 0').bind(id).first();
  return row && row.key_hash === await hashKey(key) ? row : null;
}

const shownFilms = async (db, where, args) => {
  const rows = (await db.prepare(`SELECT f.channel_id, f.film_id FROM channel_films f JOIN channels c ON c.id = f.channel_id WHERE ${where} ORDER BY f.channel_id, f.position`).bind(...args).all()).results;
  const map = new Map();
  for (const r of rows) {
    if (isTakenDown(r.film_id)) continue;
    if (!map.has(r.channel_id)) map.set(r.channel_id, []);
    map.get(r.channel_id).push(r.film_id);
  }
  return map;
};

// By id or by handle
export async function getProfile(db, idOrHandle) {
  const key = cleanHandle(idOrHandle);
  const column = ID.test(key) ? 'id' : HANDLE.test(key) ? 'handle' : null;
  const p = column && await db.prepare(`SELECT id, name, archive_user, handle FROM profiles WHERE ${column} = ? AND hidden = 0`).bind(key).first();
  if (!p) return null;
  const { id } = p;
  // Oldest first, so each keeps its place as channels are edited
  const rows = (await db.prepare("SELECT id, name, status FROM channels WHERE profile_id = ? AND status != 'hidden' ORDER BY created, rowid").bind(id).all()).results;
  const shown = await shownFilms(db, 'c.profile_id = ?', [id]);
  const channels = rows.map(c => ({ ...c, films: (shown.get(c.id) || []).length }));
  const favourites = (await db.prepare('SELECT film_id FROM favourites WHERE profile_id = ? ORDER BY created DESC').bind(id).all()).results.map(r => r.film_id).filter(f => !isTakenDown(f));
  const saved = (await db.prepare("SELECT c.id, c.name FROM channel_saves s JOIN channels c ON c.id = s.channel_id JOIN profiles o ON o.id = c.profile_id WHERE s.profile_id = ? AND c.status != 'hidden' AND o.hidden = 0 ORDER BY s.created DESC").bind(id).all()).results;
  return { id: p.id, name: p.name, archiveUser: p.archive_user, handle: p.handle, channels, favourites, saved };
}

const BRAND = ['orphanedfilms', 'admin', 'administrator', 'moderator', 'official'];
const WORDS = new Set(['mod', 'mods', 'staff', 'team', 'support', 'system', 'admin', 'official']);
export function isReservedName(name) {
  const flat = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (BRAND.some(w => flat.startsWith(w))) return true;
  return String(name || '').toLowerCase().split(/[^a-z0-9]+/).some(w => WORDS.has(w));
}

// A changed or removed handle stays with its profile this long, and redirects to it
export const HOLD = 30 * 86_400_000;

export function handleProblem(handle) {
  if (!HANDLE.test(handle) || ID.test(handle)) return 'invalid';
  if (isReservedName(handle) || isForbidden({ title: handle.replace(/[-_]+/g, ' ') })) return 'reserved';
  return null;
}

// Handles out of reach for `profileId`: in use by another profile, or held for one
async function handlesTaken(db, handles, profileId, now) {
  const marks = handles.map(() => '?').join(', ');
  const rows = (await db.prepare(`SELECT handle FROM profiles WHERE handle IN (${marks}) AND id IS NOT ?
    UNION SELECT handle FROM handle_holds WHERE handle IN (${marks}) AND profile_id IS NOT ? AND until > ?`)
    .bind(...handles, profileId, ...handles, profileId, now).all()).results;
  return new Set(rows.map(r => r.handle));
}

// Free variants of a taken handle: the first free numbered one, then the others in order
export async function suggestHandles(db, handle, profileId, now) {
  const variants = handleVariants(handle).filter(h => !handleProblem(h));
  const taken = await handlesTaken(db, variants, profileId, now);
  const free = variants.filter(h => !taken.has(h));
  const numbered = free.filter(h => /\d$/.test(h));
  return [...numbered.slice(0, 1), ...free.filter(h => !/\d$/.test(h)), ...numbered.slice(1)].slice(0, 3);
}

// Whether `value` could be this profile's handle (`profileId` null for anyone)
export async function checkHandle(db, value, profileId, now) {
  const handle = cleanHandle(value);
  const reason = handleProblem(handle) || ((await handlesTaken(db, [handle], profileId, now)).size ? 'taken' : null);
  if (!reason) return { available: true };
  return reason === 'taken' ? { available: false, reason, suggestions: await suggestHandles(db, handle, profileId, now) } : { available: false, reason };
}

// The address a changed or removed handle now leads to (the new handle or the id), while held
export async function movedHandle(db, value, now) {
  const handle = cleanHandle(value);
  if (!HANDLE.test(handle)) return null;
  const p = await db.prepare('SELECT p.id, p.handle FROM handle_holds h JOIN profiles p ON p.id = h.profile_id WHERE h.handle = ? AND h.until > ? AND p.hidden = 0').bind(handle, now).first();
  return p ? p.handle || p.id : null;
}

// Set, change or remove (null or '') a handle. The one it replaces is held for this profile.
// Uniqueness is the database's: a claim that loses a race fails as 'taken'.
async function setHandle(db, id, value, now) {
  const handle = cleanHandle(value);
  const problem = handle && handleProblem(handle);
  if (problem) return problem;
  const current = (await db.prepare('SELECT handle FROM profiles WHERE id = ?').bind(id).first())?.handle || '';
  if (handle === current) return null;
  const hold = current && db.prepare(`INSERT INTO handle_holds (handle, profile_id, until) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM profiles WHERE id = ? AND handle IS ?)
    ON CONFLICT (handle) DO UPDATE SET profile_id = excluded.profile_id, until = excluded.until`).bind(current, id, now + HOLD, id, handle || null);
  try {
    const [claimed] = await db.batch([
      db.prepare('UPDATE profiles SET handle = ?, updated = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM handle_holds WHERE handle = ? AND profile_id != ? AND until > ?)')
        .bind(handle || null, now, id, handle, id, now),
      db.prepare('DELETE FROM handle_holds WHERE until <= ? OR (handle = ? AND profile_id = ?)').bind(now, handle, id),
      ...(hold ? [hold] : []),
    ]);
    return claimed.meta.changes ? null : 'taken';
  } catch (error) {
    if (/UNIQUE constraint/i.test(error.message)) return 'taken';
    throw error;
  }
}

export async function updateProfile(db, id, { name, archiveUser, agreed, handle }, { now }) {
  if (name !== undefined && isReservedName(name)) return 'reserved';
  if (handle !== undefined) {
    const problem = await setHandle(db, id, handle, now);
    if (problem) return problem;
  }
  const sets = [];
  const args = [];
  if (name !== undefined) { sets.push('name = ?'); args.push(cleanText(name, LIMITS.displayName)); }
  if (archiveUser !== undefined) { sets.push('archive_user = ?'); args.push(cleanText(archiveUser, 60).replace(/[^\w.-]/g, '')); }
  if (agreed) { sets.push('agreed_at = COALESCE(agreed_at, ?)'); args.push(now); }
  if (!sets.length) return;
  await db.prepare(`UPDATE profiles SET ${sets.join(', ')}, updated = ? WHERE id = ?`).bind(...args, now, id).run();
}

export async function setFavourite(db, profileId, film, on, { now }) {
  if (!FILM.test(String(film)) || (on && refused(film))) return false;
  if (!on) { await db.prepare('DELETE FROM favourites WHERE profile_id = ? AND film_id = ?').bind(profileId, film).run(); return true; }
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM favourites WHERE profile_id = ?').bind(profileId).first();
  if (n >= LIMITS.favourites) return false;
  await db.prepare('INSERT OR IGNORE INTO favourites (profile_id, film_id, created) VALUES (?, ?, ?)').bind(profileId, film, now).run();
  return true;
}

const storedFilms = async (db, channelId) => (await db.prepare('SELECT film_id, note, flagged FROM channel_films WHERE channel_id = ? ORDER BY position').bind(channelId).all()).results;

const filmRows = async (db, channelId, films, flag, stored = []) => {
  const known = new Map(stored.map(r => [r.film_id, r.flagged]));
  const all = await Promise.all(films.map(async f => ({ ...f, mark: known.has(f.film) ? known.get(f.film) : await flag(f.film) })));
  const kept = all.filter(f => f.mark !== 'forbidden');
  return [
    db.prepare('DELETE FROM channel_films WHERE channel_id = ?').bind(channelId),
    ...kept.map((f, i) => db.prepare('INSERT INTO channel_films (channel_id, film_id, position, note, flagged) VALUES (?, ?, ?, ?, ?)').bind(channelId, f.film, i, f.note, f.mark ? 1 : 0)),
  ];
};

export async function createChannel(db, profileId, { name, description, films }, { now, flag }) {
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM channels WHERE profile_id = ?').bind(profileId).first();
  if (n >= LIMITS.channels) return null;
  const id = newId();
  await db.batch([
    db.prepare('INSERT INTO channels (id, profile_id, name, description, created, updated) VALUES (?, ?, ?, ?, ?, ?)').bind(id, profileId, cleanText(name, LIMITS.name) || 'Untitled channel', cleanLines(description, LIMITS.description), now, now),
    ...(await filmRows(db, id, cleanFilms(films), flag)),
  ]);
  return id;
}

export async function getChannel(db, id) {
  if (!ID.test(String(id))) return null;
  const c = await db.prepare("SELECT c.*, p.name AS owner FROM channels c JOIN profiles p ON p.id = c.profile_id WHERE c.id = ? AND c.status != 'hidden' AND p.hidden = 0").bind(id).first();
  if (!c) return null;
  const rows = (await db.prepare('SELECT film_id, note, flagged FROM channel_films WHERE channel_id = ? ORDER BY position').bind(id).all()).results;
  return {
    id: c.id, profileId: c.profile_id, owner: c.owner, name: c.name, description: c.description, status: c.status,
    films: rows.filter(r => !isTakenDown(r.film_id)).map(r => ({ film: r.film_id, note: r.note, flagged: !!r.flagged })),
  };
}

export async function updateChannel(db, id, profileId, patch, { now, flag }) {
  const c = await db.prepare("SELECT status, name, description FROM channels WHERE id = ? AND profile_id = ? AND status != 'hidden'").bind(id, profileId).first();
  if (!c) return false;
  const stored = patch.films === undefined ? [] : await storedFilms(db, id);
  const visible = stored.filter(r => !isTakenDown(r.film_id));
  const films = patch.films === undefined ? null : cleanFilms(patch.films);
  const notes = new Map(visible.map(r => [r.film_id, r.note]));
  const filmsChanged = films !== null && (films.length !== visible.length || films.some(f => notes.get(f.film) !== f.note));
  const name = patch.name === undefined ? null : (cleanText(patch.name, LIMITS.name) || 'Untitled channel');
  const description = patch.description === undefined ? null : cleanLines(patch.description, LIMITS.description);
  const contentChanged = (name !== null && name !== c.name) || (description !== null && description !== c.description) || filmsChanged;
  const status = contentChanged ? afterContentEdit(c.status) : c.status;
  const statements = [db.prepare('UPDATE channels SET name = COALESCE(?, name), description = COALESCE(?, description), status = ?, updated = ? WHERE id = ?')
    .bind(name, description, status, now, id)];
  if (films !== null) statements.push(...(await filmRows(db, id, films, flag, stored)));
  await db.batch(statements);
  return true;
}

export async function deleteChannel(db, id, profileId) {
  const owned = await db.prepare('SELECT id FROM channels WHERE id = ? AND profile_id = ?').bind(id, profileId).first();
  if (!owned) return false;
  await db.batch([
    db.prepare('DELETE FROM channel_films WHERE channel_id = ?').bind(id),
    db.prepare('DELETE FROM channel_saves WHERE channel_id = ?').bind(id),
    db.prepare('DELETE FROM channels WHERE id = ?').bind(id),
  ]);
  return true;
}

export async function submitChannel(db, id, profileId, { now, flag }) {
  const p = await db.prepare('SELECT agreed_at FROM profiles WHERE id = ?').bind(profileId).first();
  const owned = await db.prepare('SELECT status FROM channels WHERE id = ? AND profile_id = ?').bind(id, profileId).first();
  if (!owned || owned.status === 'hidden') return 'hidden';
  if (!p?.agreed_at) return 'not-agreed';
  const flagged = (await storedFilms(db, id)).filter(r => r.flagged && !isTakenDown(r.film_id));
  const marks = await Promise.all(flagged.map(r => flag(r.film_id)));
  const updates = flagged.flatMap((r, i) => (marks[i] === 'forbidden'
    ? [db.prepare('DELETE FROM channel_films WHERE channel_id = ? AND film_id = ?').bind(id, r.film_id)]
    : marks[i] ? [] : [db.prepare('UPDATE channel_films SET flagged = 0 WHERE channel_id = ? AND film_id = ?').bind(id, r.film_id)]));
  if (updates.length) await db.batch(updates);
  const c = await db.prepare('SELECT status FROM channels WHERE id = ? AND profile_id = ?').bind(id, profileId).first();
  const shown = (await storedFilms(db, id)).filter(r => !isTakenDown(r.film_id));
  c.films = shown.length;
  c.flagged = shown.filter(r => r.flagged).length;
  const problem = submitProblem(c);
  if (problem) return problem;
  if (c.status === 'unlisted') await db.prepare("UPDATE channels SET status = 'submitted', submitted_at = ? WHERE id = ?").bind(now, id).run();
  return null;
}

export async function setSaved(db, profileId, channelId, on, { now }) {
  if (!ID.test(String(channelId))) return false;
  if (!on) { await db.prepare('DELETE FROM channel_saves WHERE profile_id = ? AND channel_id = ?').bind(profileId, channelId).run(); return true; }
  const exists = await db.prepare("SELECT c.id FROM channels c JOIN profiles o ON o.id = c.profile_id WHERE c.id = ? AND c.status != 'hidden' AND o.hidden = 0").bind(channelId).first();
  if (!exists) return false;
  await db.prepare('INSERT OR IGNORE INTO channel_saves (profile_id, channel_id, created) VALUES (?, ?, ?)').bind(profileId, channelId, now).run();
  return true;
}

// Featured first (newest feature first), then public by saves*10 + minutes watched
export async function listChannels(db, { minutes }) {
  const rows = (await db.prepare(`
    SELECT c.id, c.name, c.status, c.featured_at, p.name AS owner,
      (SELECT COUNT(*) FROM channel_saves s WHERE s.channel_id = c.id AND s.profile_id != c.profile_id) AS saves
    FROM channels c JOIN profiles p ON p.id = c.profile_id
    WHERE c.status IN ('public', 'featured') AND p.hidden = 0
      AND NOT EXISTS (SELECT 1 FROM channel_films f WHERE f.channel_id = c.id AND f.flagged = 1)`).all()).results;
  const shown = await shownFilms(db, "c.status IN ('public', 'featured')", []);
  const watched = await minutes(rows.map(r => `c-${r.id}`));
  return rows
    .map(r => ({ id: r.id, name: r.name, owner: r.owner, films: (shown.get(r.id) || []).length, firstFilm: (shown.get(r.id) || [])[0], status: r.status, featuredAt: r.featured_at, score: r.saves * 10 + (watched[`c-${r.id}`] || 0) }))
    .sort((a, b) => (a.status === b.status ? (a.status === 'featured' ? (b.featuredAt || 0) - (a.featuredAt || 0) : b.score - a.score) : a.status === 'featured' ? -1 : 1))
    .filter(c => c.films > 0)
    .map(c => ({ id: c.id, name: c.name, owner: c.owner, films: c.films, firstFilm: c.firstFilm, status: c.status }));
}
