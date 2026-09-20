import test from 'node:test';
import assert from 'node:assert/strict';
import { setPosterIndex, indexedMatch, decisionToEntry } from './posterIndex.js';

test('indexedMatch: a poster entry, a deliberate "no poster" entry, and an unknown identifier are three different answers', async () => {
  setPosterIndex({
    house_on_haunted_hill: { i: 15856, t: 'House on Haunted Hill', y: 1959, p: '/poster.jpg', v: 6.7, c: 0.99 },
    snes_longplay_nosferatu: { n: 1, c: 0.97 },
  });
  assert.deepEqual(await indexedMatch('house_on_haunted_hill'), {
    id: 15856, title: 'House on Haunted Hill', posterPath: '/poster.jpg', releaseDate: '1959', voteAverage: 6.7, fromIndex: true,
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
