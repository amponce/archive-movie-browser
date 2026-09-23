import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArchiveUrl } from './archiveUrl.js';

test('a film link opens that film, however it was copied', () => {
  const film = { type: 'film', identifier: 'night_of_the_living_dead' };
  assert.deepEqual(parseArchiveUrl('https://archive.org/details/night_of_the_living_dead'), film);
  assert.deepEqual(parseArchiveUrl('  http://www.archive.org/details/night_of_the_living_dead/  '), film);
  assert.deepEqual(parseArchiveUrl('archive.org/details/night_of_the_living_dead?start=12#reviews'), film);
  assert.deepEqual(parseArchiveUrl('https://archive.org/embed/night_of_the_living_dead'), film);
  assert.deepEqual(parseArchiveUrl('https://archive.org/download/night_of_the_living_dead/night_of_the_living_dead_512kb.mp4'), { ...film, file: 'night_of_the_living_dead_512kb.mp4' });
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

test("a link to someone's Archive.org list opens it as a list", async () => {
  const list = { type: 'list', user: 'jason_scott', id: 1 };
  assert.deepEqual(parseArchiveUrl('https://archive.org/details/@jason_scott/lists/1/ballyhoo-reliquary'), list);
  assert.deepEqual(parseArchiveUrl('archive.org/details/@jason_scott/lists/1'), list);
  assert.equal(parseArchiveUrl('https://archive.org/details/@jason_scott'), null, "a person's page is not a list");
  assert.equal(parseArchiveUrl('https://archive.org/details/@bad<name>/lists/1'), null);
  assert.equal(parseArchiveUrl('https://archive.org/details/@jason_scott/lists/x'), null);
});

test('pathFor sends each kind of link to its place on this site', async () => {
  const { pathFor, parseSitePath } = await import('./archiveUrl.js');
  assert.equal(pathFor({ type: 'film', identifier: 'hexziasmovies' }), '/browse#hexziasmovies');
  assert.equal(pathFor({ type: 'list', user: 'jason_scott', id: 1 }), '/details/@jason_scott/lists/1');
  assert.equal(pathFor({ type: 'collection', id: 'Film_Noir' }), '/browse?collection=Film_Noir');
  assert.equal(pathFor({ type: 'collection', id: 'home_movies' }), '/browse?collection=home_movies&genre=all');
  assert.equal(pathFor({ type: 'search', query: 'buster keaton' }), '/browse?q=buster%20keaton');
  // archive.org/details/... with our host in front works the same
  assert.deepEqual(parseSitePath('/details/hexziasmovies/'), { type: 'film', identifier: 'hexziasmovies' });
  assert.deepEqual(parseSitePath('/details/@jason_scott/lists/1/ballyhoo-reliquary'), { type: 'list', user: 'jason_scott', id: 1 });
  assert.equal(parseSitePath('/browse'), null);
});

test('Archive.org addresses on this site, and links that arrived as search text, redirect to their place', async () => {
  const { redirectFor } = await import('./archiveUrl.js');
  assert.equal(redirectFor('/details/hexziasmovies/'), '/browse#hexziasmovies');
  assert.equal(redirectFor('/details/@jason_scott/lists/1/ballyhoo-reliquary'), null, 'a list is a page of its own');
  assert.equal(redirectFor('/browse', '?q=https%3A%2F%2Farchive.org%2Fdetails%2Fhexziasmovies%2F'), '/browse#hexziasmovies');
  assert.equal(redirectFor('/browse', '?q=https%3A%2F%2Farchive.org%2Fdetails%2F%40jason_scott%2Flists%2F1'), '/details/@jason_scott/lists/1');
  assert.equal(redirectFor('/browse', '?q=nosferatu'), null);
  assert.equal(redirectFor('/tv'), null);
});

test('a link to one file inside an upload plays that file', async () => {
  const { pathFor, parseSitePath, redirectFor, filmFromHash } = await import('./archiveUrl.js');
  const annabelle = { type: 'film', identifier: 'hexziasmovies', file: 'Annabelle Comes Home.mp4' };
  assert.deepEqual(parseArchiveUrl('https://archive.org/details/hexziasmovies/Annabelle+Comes+Home.mp4'), annabelle);
  assert.deepEqual(parseArchiveUrl('https://archive.org/download/hexziasmovies/Annabelle%20Comes%20Home.mp4'), annabelle);
  assert.deepEqual(parseSitePath('/details/hexziasmovies/Annabelle+Comes+Home.mp4'), annabelle);
  assert.equal(pathFor(annabelle), '/browse#hexziasmovies/Annabelle%20Comes%20Home.mp4');
  assert.equal(redirectFor('/details/hexziasmovies/Annabelle+Comes+Home.mp4'), '/browse#hexziasmovies/Annabelle%20Comes%20Home.mp4');
  assert.deepEqual(filmFromHash('#hexziasmovies/Annabelle%20Comes%20Home.mp4'), { identifier: 'hexziasmovies', file: 'Annabelle Comes Home.mp4' });
  assert.deepEqual(filmFromHash('#Cops1922'), { identifier: 'Cops1922', file: null });
  assert.equal(filmFromHash(''), null);
});

test("an Archive.org collection RSS feed opens that collection, newest first", async () => {
  const { pathFor } = await import('./archiveUrl.js');
  const link = parseArchiveUrl('https://archive.org/services/collection-rss.php?collection=classic_tv_1980s');
  assert.deepEqual(link, { type: 'collection', id: 'classic_tv_1980s', newest: true });
  assert.equal(pathFor(link), '/browse?collection=classic_tv_1980s&genre=all&sort=publicdate+desc');
  assert.equal(parseArchiveUrl('https://archive.org/services/collection-rss.php?collection=bad%20id'), null);
});

test('an Archive.org page with a query in its address runs that query here', () => {
  const link = parseArchiveUrl('https://archive.org/details/movies?tab=collection&query=mediatype%3Amovies++AND+subject%3Ahorror++AND+year%3A%5B1980+TO+1989%5D&page=7&and%5B%5D=mediatype%3A%22movies%22');
  assert.deepEqual(link, { type: 'search', query: 'mediatype:movies AND subject:horror AND year:[1980 TO 1989]' });
});
