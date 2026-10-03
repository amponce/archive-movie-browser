// The channels a person keeps on the server, as the TV page shows them. Pure functions.

import { MY_CHANNEL_ID } from './myChannel.js';

export const MAX_ON_TV = 10;

// Personal channels sit above the stations: the first is 0, the rest 0b, 0c, ... so the
// stations keep their numbers 1..n
export const personalNumber = i => (i === 0 ? '0' : `0${String.fromCharCode(97 + i)}`);

// profileId: this browser's profile, if any. carriedId: the profile the old browser-only list
// was copied into. channels: the profile's channels, oldest first as the server sends them, so a
// channel keeps its number when films are added. The old list shows only until it has been
// copied into this profile.
export function tvPersonal({ profileId, carriedId, channels }) {
  return {
    legacy: !profileId || carriedId !== profileId,
    saved: profileId ? (channels || []).filter(c => c.films > 0).slice(0, MAX_ON_TV).map(c => ({ id: c.id, name: c.name, films: c.films })) : [],
  };
}

// The saved channels that have something to air, numbered by their place in the whole list, so
// one that fails or has nothing on leaves a gap and the rest keep their numbers. loaded: id -> lineup.
export const airable = (list, loaded) => list.map((c, i) => ({ ...c, number: personalNumber(i) })).filter(c => loaded[c.id]?.length);

// The saved channels whose lineup has to be loaded: new ones, and ones whose film count changed
// since it was asked for. asked: id -> the film count it was last asked for at.
export const toFetch = (list, asked) => list.filter(c => asked[c.id] !== c.films);

// Whether the set should still wait for the profile's channels: while the profile loads, then
// while its channels do. A load that ended with nothing (failed, or no profile) ends the wait.
export const awaitingSaved = ({ profileId, me, tried, pending }) => !!profileId && (me ? pending : !tried);

// Once the set has picked a channel it holds on to it, so an add that reorders your channels
// does not move it: the id to hold, or null to leave the asked-for one. keepMine: the old list can
// still show, so `mine` is left as asked: with nothing on it the page shows how to start one, and it
// tunes in once its films are measured.
export const pinTo = (currentId, current, keepMine) => (current && current.id !== currentId && !(keepMine && currentId === MY_CHANNEL_ID) ? current.id : null);

// Someone watching the old list (`mine`) when it is copied to their profile stays with it: the
// old list stays on the set until the copy has loaded, then the copy stands in for it.
// copied: the id of the copy, if known. onSet: the ids of the channels on the set. left: the
// profile's channels that will not air (empty, or past the first ten). known: the ids of all the
// profile's channels, once loaded; a copy that is not among them is treated like one that will not air.
export function followCopy({ currentId, legacy, copied, onSet, left = [], known = null }) {
  if (currentId !== MY_CHANNEL_ID || legacy || !copied || left.includes(copied) || (known && !known.includes(copied))) return { id: currentId, keepOld: false };
  const copy = `c-${copied}`;
  return onSet.includes(copy) ? { id: copy, keepOld: false } : { id: currentId, keepOld: true };
}
