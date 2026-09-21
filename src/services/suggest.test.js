import test from 'node:test';
import assert from 'node:assert/strict';
import { matchRanges, localSuggestions, rememberSearch } from './suggest.js';

test('matchRanges: every typed word must start some word of the text, in any order', () => {
  assert.deepEqual(matchRanges('House on Haunted Hill', 'haun hou'), [[0, 3], [9, 13]]);
  assert.deepEqual(matchRanges('House on Haunted Hill', 'HILL'), [[17, 21]]);
  assert.equal(matchRanges('House on Haunted Hill', 'haun dracula'), null, 'one word has no match');
  assert.equal(matchRanges('House on Haunted Hill', 'ouse'), null, 'a match in the middle of a word does not count');
  assert.equal(matchRanges('House on Haunted Hill', ''), null);
  assert.equal(matchRanges('House on Haunted Hill', '   '), null);
});

test('matchRanges handles punctuation, accents and underscores in upload titles', () => {
  assert.deepEqual(matchRanges('Nosferatu_DVD_quality', 'nosf'), [[0, 4]]);
  assert.deepEqual(matchRanges("Rogue's Tavern", 'tav'), [[8, 11]]);
  assert.deepEqual(matchRanges('Nosferatu (Ótima Qualidade)', 'ótima'), [[11, 16]]);
  // two typed words that match the same title word only highlight it once
  assert.deepEqual(matchRanges('Nosferatu', 'nos nosf'), [[0, 4]]);
});

test('localSuggestions offers genres, collections, loaded films and recent searches, best first', () => {
  const source = {
    genres: ['Horror', 'History', 'Comedy'],
    collections: [{ id: 'Film_Noir', name: 'Film Noir' }, { id: 'SciFi_Horror', name: 'Sci-Fi & Horror' }],
    movies: [
      { identifier: 'a', title: 'The Horror of Party Beach', year: 1964 },
      { identifier: 'b', title: 'Horror Hotel', year: 1960 },
      { identifier: 'c', title: 'Casablanca', year: 1942 },
    ],
    recent: ['horror hotel', 'chaplin'],
  };
  const found = localSuggestions('hor', source);
  assert.deepEqual(found.map(s => `${s.type}:${s.label}`), [
    'genre:Horror', 'collection:Sci-Fi & Horror', 'recent:horror hotel', 'film:Horror Hotel', 'film:The Horror of Party Beach',
  ]);
  assert.deepEqual(found[0].ranges, [[0, 3]]);
  assert.equal(found[3].movie.identifier, 'b', 'a title that starts with the query ranks above one that merely contains it');
  assert.deepEqual(localSuggestions('zzz', source), []);
  assert.deepEqual(localSuggestions('', source).map(s => s.label), ['horror hotel', 'chaplin'], 'an empty box offers recent searches');
});

test('localSuggestions caps the list and never repeats a film', () => {
  const movies = Array.from({ length: 30 }, (_, i) => ({ identifier: `m${i}`, title: `Movie ${i}`, year: 1950 }));
  movies.push({ identifier: 'dupe', title: 'Movie 0', year: 1950 });
  const found = localSuggestions('mov', { genres: [], collections: [], movies, recent: [] });
  assert.equal(found.length, 6);
  assert.equal(new Set(found.map(s => s.label)).size, 6);
});

test('rememberSearch keeps the newest eight, without duplicates or blanks', () => {
  let recent = [];
  for (const q of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8', 'i9']) recent = rememberSearch(recent, q);
  assert.deepEqual(recent, ['i9', 'h8', 'g7', 'f6', 'e5', 'd4', 'c3', 'b2']);
  assert.deepEqual(rememberSearch(recent, 'E5').slice(0, 2), ['E5', 'i9'], 'searching again moves it to the top, case-insensitively');
  assert.deepEqual(rememberSearch(['x'], '   '), ['x']);
});

test('suggestTags offers the tags uploaders actually use, most common first', async () => {
  const { suggestTags } = await import('./suggest.js');
  const film = (...tags) => ({ tags });
  const movies = [
    film('zombies', 'horror', 'George Romero'), film('Zombie', 'Horror'), film('zombies'), film('white zombie', 'bela lugosi'),
    film('White Zombie'), film('first zombie movie'), film('zombie'), film('horror'),
  ];
  const tags = suggestTags(movies, 'zomb', { exclude: ['Horror'] });
  assert.deepEqual(tags.map(t => t.label), ['zombies', 'white zombie'], 'plural and singular are one tag; a tag used once is noise');
  assert.deepEqual(tags[0].ranges, [[0, 4]]);
  assert.deepEqual(suggestTags(movies, 'hor', { exclude: ['Horror'] }), [], 'a tag that is already a genre pill is not repeated');
  assert.deepEqual(suggestTags(movies, 'bela lug').map(t => t.label), [], 'used once');
  assert.deepEqual(suggestTags([film('a'.repeat(60) + ' zombie'), film('a'.repeat(60) + ' zombie')], 'zomb'), [], 'a sentence is not a tag');
  assert.deepEqual(suggestTags(movies, ''), []);
});
