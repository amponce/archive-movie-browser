import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, summarizeLists, validRequest, validUser } from '../../api/_archiveList.js';

test("an Archive.org list comes through as its name and identifiers; private and junk do not", () => {
  const answer = { success: true, value: { list_name: 'Ballyhoo Reliquary', description: 'Odd things.', is_private: false,
    members: [{ identifier: 'VideoCatnip1989' }, { identifier: 'bad id<script>' }, { identifier: 'VideoCatnip1989' }, {}] } };
  assert.deepEqual(summarize(answer), { name: 'Ballyhoo Reliquary', description: 'Odd things.', identifiers: ['VideoCatnip1989'] });
  assert.equal(summarize({ success: true, value: { ...answer.value, is_private: true } }), null);
  assert.equal(summarize({ success: false }), null);
  assert.ok(validRequest('jason_scott', '1'));
  assert.ok(!validRequest('../etc', '1'));
  assert.ok(!validRequest('jason_scott', '1; drop'));
});

test("someone's lists come through as names and counts; private lists and bad ids do not", () => {
  const answer = { success: true, value: [
    { id: 1, list_name: 'Ballyhoo Reliquary', is_private: false, members: [{ identifier: 'VideoCatnip1989' }, { identifier: 'orphanedfilms-takedown-test' }] },
    { id: 2, list_name: 'Secret', is_private: true, members: [] },
    { id: 'x', list_name: 'Odd', members: [] },
  ] };
  assert.deepEqual(summarizeLists(answer), [{ id: 1, name: 'Ballyhoo Reliquary', count: 1 }]);
  assert.equal(summarizeLists({ success: false, value: 'provided user does not exists' }), null);
  assert.ok(validUser('jason_scott'));
  assert.ok(!validUser('../etc'));
});
