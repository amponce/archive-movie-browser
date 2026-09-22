import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { collectLists, listBySlug, validateList } from './lists.js';

test('every list file is well formed, unique, and points at films the poster index knows', () => {
  const index = JSON.parse(readFileSync(new URL('../../public/poster-index.json', import.meta.url))).films;
  const files = readdirSync(new URL('../lists/', import.meta.url)).filter(name => name.endsWith('.json'));
  assert.ok(files.length >= 3);
  const slugs = new Set();
  for (const file of files) {
    const list = JSON.parse(readFileSync(new URL(`../lists/${file}`, import.meta.url)));
    assert.deepEqual(validateList(list), [], `${file}: ${validateList(list).join('; ')}`);
    assert.equal(`${list.slug}.json`, file, 'the file is named after its slug');
    assert.ok(!slugs.has(list.slug)); slugs.add(list.slug);
    for (const film of list.films) assert.ok(index[film.id]?.i, `${file}: ${film.id} has no poster in the index`);
  }
  const lists = collectLists(files.map(file => JSON.parse(readFileSync(new URL(`../lists/${file}`, import.meta.url)))));
  assert.equal(lists.length, files.length);
});

test('validateList names what is wrong with a list', () => {
  assert.deepEqual(validateList({ slug: 'Bad Slug', title: '', blurb: 'x', curator: 'me', films: [] }),
    ['slug must be lowercase letters, digits and dashes', 'title is required', 'films must have between 1 and 40 entries']);
  assert.deepEqual(validateList({ slug: 'ok', title: 'T', blurb: 'B', curator: 'me', films: [{ id: '../x' }, { id: 'fine', note: 42 }] }),
    ['films[0].id is not an Archive.org identifier', 'films[1].note must be a string']);
});

test('listBySlug finds a list and ignores anything else', () => {
  const lists = collectLists([{ slug: 'buster-keaton-in-an-evening', title: 'Buster Keaton in an evening', blurb: 'b', curator: 'c', films: [{ id: 'Cops1922' }] }]);
  assert.equal(listBySlug(lists, 'buster-keaton-in-an-evening').title, 'Buster Keaton in an evening');
  assert.equal(listBySlug(lists, 'nope'), null);
  assert.equal(listBySlug(lists, '__proto__'), null);
});
