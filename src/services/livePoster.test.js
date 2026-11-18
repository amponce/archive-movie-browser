import test from 'node:test';
import assert from 'node:assert/strict';
import { setPosterIndex } from './posterIndex.js';
import archiveService from './archive.js';
import tmdbService from './tmdb.js';
import { livePoster } from './livePoster.js';

test('livePoster: a film the index has not decided gets the film page\'s own lookup; one decided to have no poster gets its title only', async (t) => {
  setPosterIndex({ indexed: { i: 1, t: 'Indexed', y: 1950, p: '/i.jpg', v: 6, c: 0.9 }, no_poster: { n: 1, c: 0.9 } });
  const asked = [];
  t.mock.method(archiveService, 'getMovieByIdentifier', async id => ({ identifier: id, title: 'The Real Title', year: 1962 }));
  t.mock.method(tmdbService, '_fetchFromTMDB', async (title, year) => { asked.push([title, year]); return { id: 9, posterPath: '/live.jpg' }; });

  const bare = id => ({ id, title: id, year: null, poster: null });
  assert.deepEqual(await livePoster(bare('never_indexed')), { id: 'never_indexed', title: 'The Real Title', year: 1962, poster: tmdbService.getPosterUrl('/live.jpg', 'medium') });
  assert.deepEqual(asked, [['The Real Title', 1962]], 'asked with the title and year the film page uses');

  assert.deepEqual(await livePoster(bare('no_poster')), { id: 'no_poster', title: 'The Real Title', year: 1962, poster: null }, 'decided offline to show the generated cover: its title, and no live lookup');
  const has = { id: 'indexed', title: 'Indexed', year: 1950, poster: 'x' };
  assert.equal(await livePoster(has), has);
  assert.equal(asked.length, 1);

  archiveService.getMovieByIdentifier.mock.mockImplementation(async () => { throw new Error('gone'); });
  const lost = bare('gone_upload');
  assert.equal(await livePoster(lost), lost, 'an upload that cannot be read keeps its card');
});
