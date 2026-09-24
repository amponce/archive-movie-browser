import test from 'node:test';
import assert from 'node:assert/strict';
import { bestOfCollection } from './collectionBest.js';

test("a collection's best films: identified, one per film, well rated, best known first, never recent", () => {
  const index = {
    nosferatu_a: { i: 1, t: 'Nosferatu', y: 1922, p: '/n.jpg', c: 1, v: 7.7, k: 2500, d: 94, f: 40 },
    nosferatu_b: { i: 1, t: 'Nosferatu', y: 1922, p: '/n.jpg', c: 1, v: 7.7, k: 2500, d: 81, f: 900 },
    carrie: { i: 2, t: 'Carrie', y: 1976, p: '/c.jpg', c: 0.95, v: 7.1, k: 4000, d: 98 },
    dud: { i: 3, t: 'A dud', y: 1958, p: '/d.jpg', c: 0.9, v: 4.1, k: 30, d: 70 },
    remake: { i: 4, t: 'The Last House on the Left', y: 2009, p: '/r.jpg', c: 1, v: 6.5, k: 2000, d: 110 },
    trailer: { i: 5, t: 'King Kong', y: 1933, p: '/k.jpg', c: 1, v: 7.6, k: 1500, d: 2 },
    unsure: { i: 6, t: 'Maybe', y: 1950, p: '/m.jpg', c: 0.5, v: 8, k: 900, d: 80 },
    'orphanedfilms-takedown-test': { i: 7, t: 'Gone', y: 1950, p: '/g.jpg', c: 1, v: 8, k: 900, d: 80 },
  };
  const best = bestOfCollection(index, [...Object.keys(index), 'not-in-the-index'], { now: new Date('2026-09-24') });
  assert.deepEqual(best.films.map(f => f.id), ['carrie', 'nosferatu_b'], 'best known first; the copy people favourite');
  assert.equal(best.identified, 3, 'Nosferatu, Carrie and the dud; not the recent remake, the clip, the unsure match or a taken-down upload');
});
