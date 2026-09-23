import test from 'node:test';
import assert from 'node:assert/strict';
import { browsesIndex, indexFilms, pageOf, PAGE } from './indexBrowse.js';
import { ALL_FILMS } from './archive.js';

const index = {
  peewee: { i: 1, t: "Pee-wee's Big Adventure", y: 1985, p: '/a.jpg', v: 7.0, k: 900, c: 0.95, g: ['Comedy', 'Adventure'], l: 91, d: 90 },
  reanimator_dvd: { i: 2, t: 'Re-Animator', y: 1985, p: '/b.jpg', v: 7.2, k: 1400, c: 0.9, g: ['Horror', 'Comedy'], l: 86, d: 86 },
  reanimator_trailer: { i: 2, t: 'Re-Animator', y: 1985, p: '/b.jpg', v: 7.2, k: 1400, c: 0.97, g: ['Horror', 'Comedy'], l: 86, d: 2 },
  detour: { i: 3, t: 'Detour', y: 1945, p: '/c.jpg', v: 7.2, k: 426, c: 1, g: ['Crime', 'Drama'], l: 68, d: 68 },
  chaplin_short: { i: 4, t: 'The Rink', y: 1916, p: '/d.jpg', v: 6.9, k: 120, c: 1, g: ['Comedy'], l: 24, d: 24 },
  no_length: { i: 5, t: 'Unknown Comedy', y: 1950, p: '/e.jpg', v: 5, k: 10, c: 0.9, g: ['Comedy'], l: 95 },
  shining_trailer: { i: 6, t: 'The Shining', y: 1980, p: '/f.jpg', v: 8.2, k: 17000, c: 1, g: ['Horror'], l: 144, d: 1 },
  turner_video_2532: { i: 9, t: 'Scream', y: 1996, p: '/g.jpg', v: 7.4, k: 9000, c: 1, g: ['Horror'], l: 112 },
  'the-others-2001-720p-trailer': { i: 10, t: 'The Others', y: 2001, p: '/h.jpg', v: 7.6, k: 8000, c: 1, g: ['Horror'], l: 101 },
  no_poster: { n: 1, c: 0.9 },
};

test('the index answers a genre browse across All Films with no search text', () => {
  assert.ok(browsesIndex({ genre: 'Comedy', search: '', collection: ALL_FILMS, sort: 'downloads' }));
  assert.ok(!browsesIndex({ genre: 'all', search: '', collection: ALL_FILMS, sort: 'downloads' }), 'no genre, Archive.org as before');
  assert.ok(!browsesIndex({ genre: 'Comedy', search: 'zombie', collection: ALL_FILMS, sort: 'downloads' }), 'a search asks Archive.org');
  assert.ok(!browsesIndex({ genre: 'Comedy', search: '', collection: 'feature_films', sort: 'downloads' }), 'one collection asks Archive.org');
  assert.ok(!browsesIndex({ genre: 'Comedy', search: '', collection: ALL_FILMS, sort: 'publicdate desc' }), 'upload dates are not in the index');
});

test('indexFilms gives every film of the genre, one upload per film: the full-length one, then the surest', () => {
  const films = indexFilms(index, { genre: 'Comedy' });
  assert.deepEqual(films.map(f => f.identifier).sort(), ['chaplin_short', 'no_length', 'peewee', 'reanimator_dvd']);
  const reanimator = films.find(f => f.title === 'Re-Animator');
  assert.equal(reanimator.identifier, 'reanimator_dvd', 'the trailer was the surer match, the DVD is the film');
  assert.equal(reanimator.runtimeMinutes, 86, "the upload's length, not TMDB's");
  assert.deepEqual(Object.keys(reanimator).sort(), ['fromIndex', 'genres', 'identifier', 'runtimeMinutes', 'title', 'year']);
});

test('indexFilms filters by decade and by length like the Archive.org list', () => {
  assert.deepEqual(indexFilms(index, { genre: 'Comedy', decade: 1980 }).map(f => f.identifier).sort(), ['peewee', 'reanimator_dvd']);
  assert.deepEqual(indexFilms(index, { genre: 'Comedy', minRuntime: 40 }).map(f => f.identifier).sort(), ['no_length', 'peewee', 'reanimator_dvd'], 'a short goes, an unknown length stays');
  assert.deepEqual(indexFilms(index, { genre: 'Comedy', shorts: true }).map(f => f.identifier).sort(), ['chaplin_short', 'reanimator_trailer'], 'Shorts shows the trailer, since it is one');
  assert.deepEqual(indexFilms(index, { genre: 'Horror', minRuntime: 40 }).map(f => f.identifier), ['reanimator_dvd'], 'a one-minute upload of The Shining is not The Shining, and an unmeasured turner_video or -trailer upload is taken at its name');
  assert.deepEqual(indexFilms(index, { genre: 'Horror', shorts: true }).map(f => f.identifier).sort(), ['reanimator_trailer', 'shining_trailer', 'the-others-2001-720p-trailer', 'turner_video_2532']);
  assert.deepEqual(indexFilms(index, { genre: 'Film Noir' }), [], 'a genre TMDB does not use: nothing, so the caller asks Archive.org');
});

test('indexFilms sorts the way the menu says', () => {
  const ids = (sort) => indexFilms(index, { genre: 'Comedy', sort }).map(f => f.identifier);
  assert.deepEqual(ids('downloads'), ['reanimator_dvd', 'peewee', 'chaplin_short', 'no_length'], 'most popular is most rated');
  assert.deepEqual(ids('tmdb_rating').slice(0, 2), ['reanimator_dvd', 'peewee']);
  assert.deepEqual(ids('date desc')[0], 'peewee');
  assert.deepEqual(ids('date asc')[0], 'chaplin_short');
  assert.deepEqual(ids('title asc')[0], 'peewee');
});

test('pageOf slices 24 at a time and says when more remain', () => {
  const list = Array.from({ length: PAGE + 3 }, (_, i) => ({ identifier: `f${i}` }));
  const first = pageOf(list, 1);
  assert.equal(first.movies.length, PAGE);
  assert.ok(first.more);
  const second = pageOf(list, 2);
  assert.deepEqual(second.movies.map(m => m.identifier), ['f24', 'f25', 'f26']);
  assert.ok(!second.more);
});
