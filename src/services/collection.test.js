import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FILES, fileFor } from './collection.js';
import { isTakenDown, isRecent } from './policy.js';

const index = JSON.parse(readFileSync(new URL('../../public/poster-index.json', import.meta.url), 'utf8')).films;

test('case files are numbered 001 upward with no gaps, one per film', () => {
  FILES.forEach((file, i) => assert.equal(file.no, String(i + 1).padStart(3, '0')));
  assert.equal(new Set(FILES.map(f => f.id)).size, FILES.length);
  assert.equal(new Set(FILES.map(f => f.tmdb)).size, FILES.length, 'two files for one film');
});

test('every case file is a film the site shows, with the whole story', () => {
  for (const file of FILES) {
    const entry = index[file.id];
    assert.ok(entry?.i && entry.p, `${file.no}: not identified with a poster`);
    assert.equal(entry.i, file.tmdb, `${file.no}: tmdb id does not match the index`);
    assert.ok(!isTakenDown(file.id) && !isRecent(entry.y), `${file.no}: not one the site shows`);
    for (const field of ['cause', 'made', 'means', 'lost', 'found', 'fact']) assert.ok(file[field]?.length > 5, `${file.no}: no ${field}`);
  }
});

test('a case file is found by its film, whichever upload is showing', () => {
  assert.equal(fileFor(FILES[0].tmdb).no, '001');
  assert.equal(fileFor(String(FILES[1].tmdb)).no, '002');
  assert.equal(fileFor(0), undefined);
  assert.equal(fileFor(undefined), undefined);
});
