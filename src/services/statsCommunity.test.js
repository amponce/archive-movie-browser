import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from './testDb.js';
import { communityOf } from '../../api/stats.js';
import { statsDay } from '../../api/_stats.js';

test('stats: changes per Pacific day, networks with 2+ new profiles, latest changes', async () => {
  const db = await openTestDb();
  const now = Date.parse('2026-10-03T20:00:00Z');
  const hour = 3_600_000;
  const days = Array.from({ length: 14 }, (_, i) => statsDay(new Date(now - (13 - i) * 86_400_000)));
  await db.prepare("INSERT INTO profiles (id, key_hash, name, handle, created, updated) VALUES ('aaaaaaaaaa', 'h', 'Ann', 'ann', 0, 0)").run();
  await db.prepare("INSERT INTO channels (id, profile_id, name, created, updated) VALUES ('cccccccccc', 'aaaaaaaaaa', 'Night', 0, 0)").run();
  const add = (at, kind, net, { channelId = null, detail = null } = {}) => db.prepare('INSERT INTO history (at, kind, profile_id, channel_id, net, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(at, kind, 'aaaaaaaaaa', channelId, net, detail && JSON.stringify(detail)).run();
  for (let i = 0; i < 3; i++) await add(now - i * hour, 'profile-created', 'aaaaaabbbbbbcccc');
  await add(now, 'profile-created', 'ffffff0000000000');
  await add(now - 8 * 86_400_000, 'profile-created', 'eeeeee0000000000');
  await add(now - 8 * 86_400_000, 'profile-created', 'eeeeee0000000000');
  await add(now, 'channel-created', null, { channelId: 'cccccccccc', detail: { name: 'Old name' } });
  await add(now, 'channel-edited', 'aaaaaabbbbbbcccc', { channelId: 'cccccccccc' });
  await add(now, 'channel-deleted', 'aaaaaabbbbbbcccc', { channelId: 'gonegonego', detail: { name: 'Gone', description: '', films: [] } });
  // 03:00 UTC on the 3rd is still the 2nd in Pacific time
  await add(Date.parse('2026-10-03T03:00:00Z'), 'channel-edited', null);

  const out = await communityOf(db, days, now);
  assert.equal(out.days.length, 14);
  assert.deepEqual(out.days.at(-1), { day: '2026-10-03', profiles: 4, channels: 1, edits: 1, deleted: 1 });
  assert.deepEqual(out.days.at(-2), { day: '2026-10-02', profiles: 0, channels: 0, edits: 1, deleted: 0 });
  assert.equal(out.days.reduce((n, d) => n + d.profiles, 0), 6, 'the two older profiles fall on day 9 of 14');
  assert.deepEqual(out.networks, [{ net: 'aaaaaabbbbbbcccc', profiles: 3 }]);
  assert.equal(out.latest.length, 10);
  assert.deepEqual(out.latest[0], { at: Date.parse('2026-10-03T03:00:00Z'), kind: 'channel-edited', net: null, channel: null, name: 'Ann', handle: 'ann' });
  assert.equal(out.latest[1].channel, 'Gone');
  assert.equal(out.latest[3].channel, 'Night', 'a channel that still exists shows its name now');
  assert.ok(out.latest.every(r => r.net === null || r.net.length === 6));
  assert.equal(await communityOf(null, days, now), null);
});
