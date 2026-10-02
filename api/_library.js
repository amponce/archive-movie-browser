// The library pack: the whole catalogue as a folder of films for Kodi, Jellyfin and Emby, so it
// shows as a movie library (posters, plots, genres, resume) instead of TV channels. One folder
// per film holding a .strm file (a text file with the film's address) and an .nfo that names
// the film's TMDB id, so every film is matched exactly. Plex does not read .strm files.
import { crc32 } from 'node:zlib';
import { catalogue } from './_tv.js';

const SITE = 'https://www.orphanedfilms.com';
const ROOT = 'Orphaned Films';

// A name every file system and unzip tool accepts: plain ASCII (older unzips mangle accents),
// so "La búsqueda" is "La busqueda". The apps show the real title, from the .nfo and TMDB.
const safe = (s, tmdb) => {
  const name = String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]+/g, ' ')
    .replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '');
  return /[a-z0-9]/i.test(name) ? name : `Film ${tmdb}`; // a title in another script: its TMDB id
};
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Jellyfin reads [tmdbid-N] in the folder name; Kodi reads the .nfo, whose last line is the
// TMDB address (a "combination" .nfo: the details above it, the rest scraped from that address)
export function libraryFiles(films = catalogue(), site = SITE) {
  const files = [];
  for (const film of films) {
    const name = `${safe(film.title, film.tmdb)}${film.year ? ` (${film.year})` : ''}`;
    const folder = `${ROOT}/${name} [tmdbid-${film.tmdb}]`;
    files.push([`${folder}/${name}.strm`, `${site}/api/tv/film/${encodeURIComponent(film.id)}\n`]);
    files.push([`${folder}/${name}.nfo`, [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<movie>',
      `  <title>${xml(film.title)}</title>`,
      film.year ? `  <year>${film.year}</year>` : null,
      `  <uniqueid type="tmdb" default="true">${film.tmdb}</uniqueid>`,
      ...film.genres.map(g => `  <genre>${xml(g)}</genre>`),
      '</movie>',
      `https://www.themoviedb.org/movie/${film.tmdb}`,
      '',
    ].filter(line => line !== null).join('\n')]);
  }
  files.push([`${ROOT}/README.txt`, `Orphaned Films: ${films.length} films from the Internet Archive, as a movie library.\n\nPut this folder where Kodi, Jellyfin or Emby can see it and add it as a Movies library.\nEach film streams from the Archive when you play it. Setup: ${site}/iptv\n`]);
  return files;
}

// A zip with no compression (the files are tiny; the names are most of it). Written by hand to
// keep dependencies out: local headers, the central directory, and the end record.
// ponytail: 3.4 MB for 4,200 films, built whole in the Worker's memory. If it grows a lot,
// build it on a schedule into R2 or split it by decade.
export function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.from(text, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28); entry.writeUInt32LE(offset, 42);
    parts.push(local, nameBytes, data);
    central.push(entry, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}
