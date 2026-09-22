import test from 'node:test';
import assert from 'node:assert/strict';
import { apiSort, orderBatch } from './sorting.js';

test('apiSort turns a sort option into what Archive.org is asked for', () => {
  assert.deepEqual(apiSort('downloads'), { sortBy: 'downloads', sortOrder: 'desc' });
  assert.deepEqual(apiSort('date asc'), { sortBy: 'date', sortOrder: 'asc' });
  assert.deepEqual(apiSort('title asc'), { sortBy: 'title', sortOrder: 'asc' });
  assert.deepEqual(apiSort('tmdb_rating'), { sortBy: 'downloads', sortOrder: 'desc' }, 'a TMDB rating is not something Archive.org can sort by');
});

test('orderBatch ranks a batch once, by the rule the sort option needs', async () => {
  const movies = [{ identifier: 'a' }, { identifier: 'b' }];
  const byRating = async (batch) => [...batch].reverse();
  const withPosters = async (batch) => [batch[1], batch[0]];
  assert.deepEqual(await orderBatch(movies, 'tmdb_rating', { byRating, withPosters }), [movies[1], movies[0]]);
  assert.deepEqual(await orderBatch(movies, 'downloads', { byRating, withPosters }), [movies[1], movies[0]]);
  assert.deepEqual(await orderBatch(movies, 'title asc', { byRating, withPosters }), movies, 'a visible order is left as Archive.org returned it');
});
