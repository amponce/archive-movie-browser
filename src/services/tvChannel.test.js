import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/tv.js';
import { schedule } from '../../api/_tv.js';
import { createProfile, createChannel } from '../../api/_community.js';
import { openTestDb } from './testDb.js';

const now = 1_700_000_000_000;
const noFlag = async () => false;
const listFilm = schedule().channels[0].lineup[0];

// GET /api/tv?channel=<id>, answered as the Worker would
async function get(db, id) {
  const res = { status: 200, headers: {}, body: null };
  const out = {
    status(code) { res.status = code; return out; },
    setHeader(key, value) { res.headers[key] = value; return out; },
    json(value) { res.body = value; },
    send(value) { res.body = value; },
    end() {},
  };
  await handler({ method: 'GET', query: { channel: id }, headers: { 'cf-connecting-ip': `test-${Math.random()}` } }, out, { DB: db });
  return res;
}

// archive.org's metadata answers, counted per identifier
function stubArchive(answers) {
  const calls = {};
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const id = decodeURIComponent(String(url).match(/archive\.org\/metadata\/([^/?]+)/)?.[1] || '');
    calls[id] = (calls[id] || 0) + 1;
    const answer = answers[id];
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer || {}), { status: answer ? 200 : 503 });
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

const playable = title => ({ metadata: { title }, files: [{ name: 'film.mp4', format: 'h.264', length: '5400', source: 'derivative' }] });

async function channelOf(films, name = 'Late Show') {
  const db = await openTestDb();
  const { id: pid } = await createProfile(db, { now });
  const id = await createChannel(db, pid, { name, films: films.map(film => ({ film })) }, { now, flag: noFlag });
  return { db, id };
}

test('a community channel is built on the server: list films from bundled data, the rest read once', async () => {
  const { db, id } = await channelOf([listFilm.id, 'tvchannel-unknown-a']);
  const archive = stubArchive({ 'tvchannel-unknown-a': playable('A Lost Film') });
  try {
    const first = await get(db, id);
    assert.equal(first.status, 200);
    assert.equal(first.headers['Cache-Control'], 'public, s-maxage=60');
    const [channel] = first.body.channels;
    assert.equal(channel.id, `c-${id}`);
    assert.equal(channel.name, 'Late Show');
    assert.equal(channel.blurb, '');
    assert.deepEqual(channel.lineup.map(f => f.id).sort(), [listFilm.id, 'tvchannel-unknown-a'].sort());
    const lost = channel.lineup.find(f => f.id === 'tvchannel-unknown-a');
    assert.equal(lost.seconds, 5400);
    assert.match(lost.url, /tvchannel-unknown-a\/film\.mp4$/);
    assert.ok(channel.now && channel.programmes.length);
    assert.equal(archive.calls[listFilm.id], undefined, 'a list film needs no lookup');
    await get(db, id);
    assert.equal(archive.calls['tvchannel-unknown-a'], 1, 'remembered after the first read');
  } finally { archive.restore(); }
});

test('a film whose record cannot be read is left out and asked again next time', async () => {
  const { db, id } = await channelOf([listFilm.id, 'tvchannel-unknown-b']);
  const archive = stubArchive({ 'tvchannel-unknown-b': new Error('timeout') });
  try {
    const first = await get(db, id);
    assert.deepEqual(first.body.channels[0].lineup.map(f => f.id), [listFilm.id]);
    assert.equal(first.headers['Cache-Control'], 'no-store', 'a short lineup is not kept');
    assert.equal('missed' in first.body.channels[0], false);
    await get(db, id);
    assert.equal(archive.calls['tvchannel-unknown-b'], 2, 'a failure is not remembered');
  } finally { archive.restore(); }
  const later = stubArchive({ 'tvchannel-unknown-b': playable('Back Again') });
  try {
    const again = await get(db, id);
    assert.equal(again.body.channels[0].lineup.length, 2);
    assert.equal(again.headers['Cache-Control'], 'public, s-maxage=60');
  } finally { later.restore(); }
});

test('a hidden or unknown channel is a 404', async () => {
  const { db, id } = await channelOf([listFilm.id]);
  await db.prepare("UPDATE channels SET status = 'hidden' WHERE id = ?").bind(id).run();
  assert.equal((await get(db, id)).status, 404);
  assert.equal((await get(db, 'abcdefghij')).status, 404);
  assert.equal((await get(db, 'not-an-id')).status, 404);
});
