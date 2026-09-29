// The Orphan Collection: numbered case files, each telling how a film was lost and how it was
// found. A volume is a JSON file in src/collection; files are numbered across volumes.
import volume1 from '../collection/volume-1.json' with { type: 'json' };

export const VOLUMES = [volume1];
export const FILES = VOLUMES.flatMap(v => v.files.map(file => ({ ...file, volume: v.volume })));

const byFilm = new Map(FILES.map(file => [file.tmdb, file]));
// The case file for a film (its TMDB id, so any upload of it finds the file), or undefined
export const fileFor = tmdbId => byFilm.get(Number(tmdbId));
