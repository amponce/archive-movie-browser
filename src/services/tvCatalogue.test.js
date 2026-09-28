import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue, toFilmsM3U, isCatalogued } from '../../api/_tv.js';
import { isTakenDown, isRecent, TAKEN_DOWN } from './policy.js';

test('the catalogue is every identified feature film once, none the channels keep off air', () => {
  const films = catalogue();
  assert.ok(films.length > 3000, `${films.length} films`);
  assert.equal(new Set(films.map(f => f.tmdb)).size, films.length, 'one upload per film');
  for (const film of films) {
    assert.ok(film.poster && film.tmdb && film.title, film.id);
    assert.ok(!isTakenDown(film.id) && !isRecent(film.year), film.id);
  }
  for (const { id } of TAKEN_DOWN) assert.equal(isCatalogued(id), false, id);
  assert.ok(films.some(f => f.title === 'Nosferatu' && f.year === 1922));
});

test('the films playlist groups by genre and sends players through the film link', () => {
  const m3u = toFilmsM3U([{ id: 'Nosferatu_x', tmdb: 653, title: 'Nosferatu, "the" vampire', year: 1922, poster: 'https://image.tmdb.org/t/p/w342/a.jpg', genre: 'Horror', minutes: 94 }], 'https://example.test');
  const lines = m3u.trim().split('\n');
  assert.equal(lines[0], '#EXTM3U');
  assert.match(lines[3], /^#EXTINF:5640 .*tvg-logo="https:\/\/image\.tmdb\.org\/t\/p\/w342\/a\.jpg" group-title="Horror",Nosferatu, "the" vampire \(1922\)$/);
  assert.doesNotMatch(lines[3].split(',')[0], /"the"/, 'quotes inside attributes are replaced');
  assert.equal(lines[4], 'https://example.test/api/tv/film/Nosferatu_x');
});
