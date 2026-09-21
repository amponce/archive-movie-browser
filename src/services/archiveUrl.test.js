import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArchiveUrl } from './archiveUrl.js';

test('a film link opens that film, however it was copied', () => {
  const film = { type: 'film', identifier: 'night_of_the_living_dead' };
  assert.deepEqual(parseArchiveUrl('https://archive.org/details/night_of_the_living_dead'), film);
  assert.deepEqual(parseArchiveUrl('  http://www.archive.org/details/night_of_the_living_dead/  '), film);
  assert.deepEqual(parseArchiveUrl('archive.org/details/night_of_the_living_dead?start=12#reviews'), film);
  assert.deepEqual(parseArchiveUrl('https://archive.org/embed/night_of_the_living_dead'), film);
  assert.deepEqual(parseArchiveUrl('https://archive.org/download/night_of_the_living_dead/night_of_the_living_dead_512kb.mp4'), film);
  assert.deepEqual(parseArchiveUrl('https://archive.org/details/Cops1922'), { type: 'film', identifier: 'Cops1922' });
});

test('a link to a collection the app carries switches to it', () => {
  assert.deepEqual(parseArchiveUrl('https://archive.org/details/Film_Noir'), { type: 'collection', id: 'Film_Noir' });
  assert.deepEqual(parseArchiveUrl('https://archive.org/details/feature_films?tab=collection'), { type: 'collection', id: 'feature_films' });
});

test('an Archive.org search link runs the same search here', () => {
  assert.deepEqual(parseArchiveUrl('https://archive.org/search?query=buster+keaton'), { type: 'search', query: 'buster keaton' });
  assert.deepEqual(parseArchiveUrl('https://archive.org/search.php?query=title%3A%28nosferatu%29'), { type: 'search', query: 'title:(nosferatu)' });
  assert.equal(parseArchiveUrl('https://archive.org/search?query='), null);
});

test('everything else is left alone as ordinary search text', () => {
  for (const text of ['night of the living dead', '', 'archive', 'https://example.com/details/night_of_the_living_dead',
    'https://archive.org.evil.com/details/x', 'https://notarchive.org/details/x', 'https://archive.org/', 'https://archive.org/about',
    'https://archive.org/details/', 'https://archive.org/details/bad%20id%3Cscript%3E', 'javascript:alert(1)', 'https://web.archive.org/web/2020/http://x.com']) {
    assert.equal(parseArchiveUrl(text), null, text);
  }
});
