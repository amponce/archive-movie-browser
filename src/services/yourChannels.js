// The channels a person keeps on the server, as the TV page shows them. Pure functions.

import { MY_CHANNEL_ID } from './myChannel.js';

export const MAX_ON_TV = 10;

// Personal channels sit above the stations: the first is 0, the rest 0b, 0c, ... so the
// stations keep their numbers 1..n
export const personalNumber = i => (i === 0 ? '0' : `0${String.fromCharCode(97 + i)}`);

// profileId: this browser's profile, if any. carriedId: the profile the old browser-only list
// was copied into. channels: the profile's channels, each with its `created` time. They go
// oldest first, so a channel keeps its number when films are added. The old list shows only
// until it has been copied into this profile.
export function tvPersonal({ profileId, carriedId, channels }) {
  const byAge = [...(channels || [])].sort((a, b) => (a.created || 0) - (b.created || 0));
  return {
    legacy: !profileId || carriedId !== profileId,
    saved: profileId ? byAge.filter(c => c.films > 0).slice(0, MAX_ON_TV).map(c => ({ id: c.id, name: c.name })) : [],
  };
}

// Once the set has picked a channel it holds on to it, so an add that reorders your channels
// does not move it: the id to hold, or null to leave the asked-for one. `mine` is left as asked:
// with nothing on it the page shows how to start one, and it tunes in once its films are measured.
export const pinTo = (currentId, current) => (current && current.id !== currentId && currentId !== MY_CHANNEL_ID ? current.id : null);
