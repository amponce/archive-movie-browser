// Which TMDB lookups ../api/tmdb.js passes on: only what the site asks, one address per answer
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmdbUrl } from '../api/tmdb.js';

test('the three lookups the site makes go through', () => {
  assert.match(tmdbUrl({ path: 'search/movie', query: 'nosferatu' }, 'k'), /search\/movie\?api_key=k&query=nosferatu&include_adult=false$/);
  assert.match(tmdbUrl({ path: 'movie/653', append_to_response: 'credits' }, 'k'), /movie\/653\?api_key=k&append_to_response=credits$/);
  assert.ok(tmdbUrl({ path: 'genre/movie/list' }, 'k'));
});

test('anything that would make a second address for the same answer is refused', () => {
  assert.equal(tmdbUrl({ path: 'movie/653', x: '123' }, 'k'), null);
  assert.equal(tmdbUrl({ path: 'movie/653', append_to_response: 'videos' }, 'k'), null);
  assert.equal(tmdbUrl({ path: 'search/movie', query: 'Nosferatu' }, 'k'), null);
  assert.equal(tmdbUrl({ path: 'search/movie', query: 'nosferatu', page: '2' }, 'k'), null);
  assert.equal(tmdbUrl({ path: 'person/1' }, 'k'), null);
});
