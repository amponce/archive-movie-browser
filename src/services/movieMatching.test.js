import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMovieTitle, selectMovieMatch } from './movieMatching.js';

const movie = (id, title, year = '1959') => ({ id, title, release_date: `${year}-01-01`, poster_path: `/${id}.jpg` });

test('title cleaning retains the search service year and punctuation normalization', () => {
  for (const title of ['The Last Man (1964)', 'The Last Man [1964]', 'The Last Man - 1964']) {
    assert.equal(cleanMovieTitle(title), 'The Last Man');
  }
  assert.equal(cleanMovieTitle('  House:  on Haunted Hill! '), 'House on Haunted Hill');
});

test('exact cleaned titles outrank earlier partial matches and prefer the known year', () => {
  const results = [movie(1, 'The Last'), movie(2, 'The Last Man', '1964'), movie(3, 'THE LAST MAN!', '1990')];
  assert.equal(selectMovieMatch(results, 'The Last Man (1990)', 1990).id, 3);
  assert.equal(selectMovieMatch(results, 'The Last Man', 2000).id, 2);
  assert.equal(selectMovieMatch(results, 'The Last Man').id, 2);
});

for (const title of ['M', 'The', 'It']) {
  test(`the short title ${title} cannot displace a higher-ranked fallback by substring alone`, () => {
    const results = [movie(1, 'A Different Film'), movie(2, title)];
    assert.equal(selectMovieMatch(results, 'The City of Missing Men').id, 1);
    assert.equal(selectMovieMatch(results, title).id, 2);
  });
}

test('close matches must be whole words and a meaningful share of the title', () => {
  const fallback = movie(1, 'A Different Film');
  assert.equal(selectMovieMatch([fallback, movie(2, 'House on Haunted Hill')], 'The House on Haunted Hill').id, 2);
  assert.equal(selectMovieMatch([fallback, movie(2, 'The House on Haunted Hill')], 'House on Haunted Hill').id, 2);
  assert.equal(selectMovieMatch([fallback, movie(2, 'House')], 'House on Haunted Hill').id, 1);
  assert.equal(selectMovieMatch([fallback, movie(2, 'Alien')], 'Aliens').id, 1);
});

test('fallback requires a poster and empty results return null', () => {
  assert.equal(selectMovieMatch([], 'Example'), null);
  assert.equal(selectMovieMatch(undefined, 'Example'), null);
  assert.equal(selectMovieMatch([{ title: 'Other' }], 'Example'), null);
  assert.equal(selectMovieMatch([movie(1, 'Other')], 'Example').id, 1);
  assert.equal(selectMovieMatch([movie(1, 'Other'), { id: 2, title: 'Example' }], 'Example').id, 2);
});
