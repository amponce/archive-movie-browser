import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue, toFilmsM3U, isCatalogued } from '../../api/_tv.js';
import { isTakenDown, isRecent, TAKEN_DOWN } from './policy.js';

test('the catalogue is every identified feature film once, none the channels keep off air', () => {
  const films = catalogue();
  assert.ok(films.length > 3000, `${films.length} films`);
  assert.equal(new Set(films.map(f => f.tmdb)).size, films.length, 'one upload per film');
  for (const film of films) {
    assert.ok(film.poster && film.tmdb && film.title, film.id);
    assert.ok(!isTakenDown(film.id) && !isRecent(film.year), film.id);
  }
  for (const { id } of TAKEN_DOWN) assert.equal(isCatalogued(id), false, id);
  assert.ok(films.some(f => f.title === 'Nosferatu' && f.year === 1922));
});

test('the films playlist groups by genre and sends players through the film link', () => {
  const m3u = toFilmsM3U([{ id: 'Nosferatu_x', tmdb: 653, title: 'Nosferatu, "the" vampire', year: 1922, poster: 'https://image.tmdb.org/t/p/w342/a.jpg', genre: 'Horror', minutes: 94 }], 'https://example.test');
  const lines = m3u.trim().split('\n');
  assert.equal(lines[0], '#EXTM3U');
  assert.match(lines[3], /^#EXTINF:5640 .*tvg-logo="https:\/\/image\.tmdb\.org\/t\/p\/w342\/a\.jpg" group-title="Horror",Nosferatu, "the" vampire \(1922\)$/);
  assert.doesNotMatch(lines[3].split(',')[0], /"the"/, 'quotes inside attributes are replaced');
  assert.equal(lines[4], 'https://example.test/api/tv/film/Nosferatu_x');
});

test('the library pack is a valid zip of one folder per film, each matched to TMDB', async () => {
  const { libraryFiles, zip } = await import('../../api/_library.js');
  const films = [
    { id: 'Nosferatu_x', tmdb: 653, title: 'Nosferatu', year: 1922, genres: ['Horror'] },
    { id: 'busqueda', tmdb: 164064, title: 'La búsqueda: "part" 1', year: 1985, genres: [] },
    { id: 'kanji', tmdb: 42, title: '七人の侍', year: 1954, genres: ['Drama'] },
  ];
  const files = libraryFiles(films, 'https://example.test');
  const names = files.map(([name]) => name);
  assert.ok(names.includes('Orphaned Films/Nosferatu (1922) [tmdbid-653]/Nosferatu (1922).strm'));
  assert.ok(names.includes('Orphaned Films/La busqueda part 1 (1985) [tmdbid-164064]/La busqueda part 1 (1985).nfo'), 'plain ASCII, no : or "');
  assert.ok(names.includes('Orphaned Films/Film 42 (1954) [tmdbid-42]/Film 42 (1954).strm'), 'a title in another script');
  assert.ok(names.every(name => /^[\x20-\x7e]+$/.test(name)));
  const strm = files.find(([name]) => name.endsWith('Nosferatu (1922).strm'))[1];
  assert.equal(strm, 'https://example.test/api/tv/film/Nosferatu_x\n');
  const nfo = files.find(([name]) => name.includes('[tmdbid-164064]') && name.endsWith('.nfo'))[1];
  assert.match(nfo, /<title>La búsqueda: "part" 1<\/title>/, 'the real title in the .nfo');
  assert.match(nfo, /<uniqueid type="tmdb" default="true">164064<\/uniqueid>/);
  assert.match(nfo, /\nhttps:\/\/www\.themoviedb\.org\/movie\/164064\n$/);

  // The zip's end record counts every file, and its directory sits where it says
  const bytes = zip(files);
  const end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  assert.equal(bytes.readUInt16LE(end + 10), files.length);
  assert.equal(bytes.readUInt32LE(bytes.readUInt32LE(end + 16)), 0x02014b50);
});
