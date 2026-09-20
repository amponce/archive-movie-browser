import test from 'node:test';
import assert from 'node:assert/strict';
import { coverDesign, COMPOSITIONS } from './coverDesign.js';

test('a film always gets the same cover, and different films get varied ones', () => {
  const movie = { identifier: 'house_on_haunted_hill', title: 'House on Haunted Hill', genres: ['Horror'] };
  assert.deepEqual(coverDesign(movie), coverDesign({ ...movie }));
  const compositions = new Set(Array.from({ length: 40 }, (_, i) => coverDesign({ identifier: `film-${i}`, title: 'X', genres: [] }).composition));
  assert.equal(compositions.size, COMPOSITIONS.length, 'every composition turns up across 40 films');
});

test('the palette follows the genre, with a house palette when there is none', () => {
  const family = genres => coverDesign({ identifier: 'a', title: 'A', genres }).family;
  assert.equal(family(['Horror', 'Drama']), 'horror');
  assert.equal(family(['Sci-Fi']), 'scifi');
  assert.equal(family(['Film Noir']), 'noir');
  assert.equal(family(['Mystery']), 'noir');
  assert.equal(family(['Western']), 'western');
  assert.equal(family(['Comedy']), 'comedy');
  assert.equal(family(['Animation']), 'animation');
  assert.equal(family(['Drama']), 'drama');
  assert.equal(family(['Uncategorized']), 'house');
  assert.equal(family(undefined), 'house');
});

test('the cover prints the film name, not the upload notes', () => {
  const title = t => coverDesign({ identifier: 'a', title: t, genres: [] }).title;
  assert.equal(title('Nosferatu_DVD_quality'), 'Nosferatu');
  assert.equal(title('Nekromantik(1987) ENGLISH HARD SUB'), 'Nekromantik');
  assert.equal(title('Phantom Ship , The'), 'The Phantom Ship');
  assert.equal(title('1984'), '1984');
});

test('title size steps down as titles get longer', () => {
  const size = t => coverDesign({ identifier: 'a', title: t, genres: [] }).titleScale;
  assert.ok(size('M') > size('House on Haunted Hill'));
  assert.ok(size('House on Haunted Hill') > size('Das Kabinett des Doktor Caligari und seine Freunde im Wunderland'));
});

test('every palette keeps the title readable against its background', () => {
  const luminance = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  for (let i = 0; i < 60; i++) for (const genres of [['Horror'], ['Sci-Fi'], ['Film Noir'], ['Western'], ['Comedy'], ['Animation'], ['Drama'], []]) {
    const { palette, family } = coverDesign({ identifier: `film-${i}`, title: 'A', genres });
    assert.ok(contrast(palette.ink, palette.field) >= 4.5, `${family} ink ${palette.ink} on ${palette.field}`);
  }
});
