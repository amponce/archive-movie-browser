import test from 'node:test';
import assert from 'node:assert/strict';
import { setPosterIndex, indexedMatch, decisionToEntry } from './posterIndex.js';

test('indexedMatch: a poster entry, a deliberate "no poster" entry, and an unknown identifier are three different answers', async () => {
  setPosterIndex({
    house_on_haunted_hill: { i: 15856, t: 'House on Haunted Hill', y: 1959, p: '/poster.jpg', v: 6.7, c: 0.99 },
    snes_longplay_nosferatu: { n: 1, c: 0.97 },
  });
  assert.deepEqual(await indexedMatch('house_on_haunted_hill'), {
    id: 15856, title: 'House on Haunted Hill', posterPath: '/poster.jpg', releaseDate: '1959', voteAverage: 6.7, fromIndex: true, confidence: 0.99,
  });
  assert.equal(await indexedMatch('snes_longplay_nosferatu'), null, 'decided offline: not a film we have a poster for');
  assert.equal(await indexedMatch('never_indexed'), undefined, 'not decided yet: the caller falls back to live matching');
  assert.equal(await indexedMatch(undefined), undefined);
});

test('decisionToEntry keeps a poster only above the confidence threshold', () => {
  const film = { id: 653, title: 'Nosferatu', release_date: '1922-03-04', poster_path: '/n.jpg', vote_average: 7.7 };
  assert.deepEqual(decisionToEntry({ film, confidence: 0.91 }), { i: 653, t: 'Nosferatu', y: 1922, p: '/n.jpg', v: 7.7, c: 0.91 });
  assert.deepEqual(decisionToEntry({ film, confidence: 0.66 }), { n: 1, c: 0.66 }, 'a wrong poster is worse than a generated cover');
  assert.equal(decisionToEntry({ film, confidence: 0.7 }).i, 653);
  assert.deepEqual(decisionToEntry({ film: null, confidence: 0.98 }), { n: 1, c: 0.98 });
  assert.deepEqual(decisionToEntry({ film: { ...film, poster_path: null }, confidence: 0.99 }), { n: 1, c: 0.99 }, 'a match without a poster is no use');
});

test('postersFirst moves films with an indexed poster ahead, keeping each group in its order', async () => {
  const { postersFirst } = await import('./posterIndex.js');
  setPosterIndex({ b: { i: 1, t: 'B', y: 1950, p: '/b.jpg', v: 6, c: 0.9 }, d: { i: 2, t: 'D', y: 1951, p: '/d.jpg', v: 7, c: 0.9 }, c: { n: 1, c: 0.9 } });
  const batch = ['a', 'b', 'c', 'd', 'e'].map(identifier => ({ identifier }));
  assert.deepEqual((await postersFirst(batch)).map(m => m.identifier), ['b', 'd', 'a', 'c', 'e']);
  assert.equal(batch[0].identifier, 'a', 'the input is not reordered');
  setPosterIndex({});
});

test('an indexed match carries its confidence, so the film page can say how it was identified', async () => {
  setPosterIndex({ dead_people_ipod: { i: 24923, t: 'Messiah of Evil', y: 1975, p: '/m.jpg', v: 6.1, c: 0.93 } });
  assert.equal((await indexedMatch('dead_people_ipod')).confidence, 0.93);
  setPosterIndex({});
});

test('identifiedAs says when the index found a different film than the upload title suggests', async () => {
  const { identifiedAs } = await import('./posterIndex.js');
  assert.deepEqual(identifiedAs({ title: 'Dead People' }, { title: 'Messiah of Evil', fromIndex: true, confidence: 0.93 }), { uploadTitle: 'Dead People', confidence: 0.93 });
  assert.equal(identifiedAs({ title: 'Night of the Living Dead' }, { title: 'Night of the Living Dead', fromIndex: true, confidence: 0.99 }), null, 'same title: nothing to reveal');
  assert.equal(identifiedAs({ title: 'night_of_the_living_dead (1968) 1080p' }, { title: 'Night of the Living Dead', fromIndex: true, confidence: 0.99 }), null, 'noise around the same title is not a different film');
  assert.equal(identifiedAs({ title: 'Dead People' }, { title: 'Messiah of Evil', fromIndex: false }), null, 'a live TMDB guess is not an index decision');
  assert.equal(identifiedAs({ title: 'Dead People' }, null), null);
});
