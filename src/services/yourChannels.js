// The channels a person keeps on the server, as the TV page shows them. Pure functions.

export const MAX_ON_TV = 10;

// Personal channels sit above the stations: the first is 0, the rest 0b, 0c, ... so the
// stations keep their numbers 1..n
export const personalNumber = i => (i === 0 ? '0' : `0${String.fromCharCode(97 + i)}`);

// profileId: this browser's profile, if any. carriedId: the profile the old browser-only list
// was copied into. channels: the profile's channels, most recently updated first (as the server
// sends them). The old list shows only until it has been copied into this profile.
export function tvPersonal({ profileId, carriedId, channels }) {
  return {
    legacy: !profileId || carriedId !== profileId,
    saved: profileId ? (channels || []).filter(c => c.films > 0).slice(0, MAX_ON_TV).map(c => ({ id: c.id, name: c.name })) : [],
  };
}
