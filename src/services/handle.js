// A profile's optional handle: its readable address, /u/<handle>. Shared by the site and the API.
export const HANDLE = /^(?=.{3,30}$)[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export const cleanHandle = value => String(value ?? '').trim().toLowerCase();

// Any text (an Archive.org username) made into the handle shape, or '' when nothing is left
export const toHandle = text => cleanHandle(text)
  .replace(/[^a-z0-9_-]+/g, '-').replace(/[-_]{2,}/g, m => m[0])
  .replace(/^[-_]+|[-_]+$/g, '').slice(0, 30).replace(/[-_]+$/, '');

// Up to 30 characters: '<name>2' to '<name>9', '<name>_films', '<name>-tv'
export function handleVariants(name) {
  const base = cleanHandle(name);
  const fit = suffix => `${base.slice(0, 30 - suffix.length).replace(/[-_]+$/, '')}${suffix}`;
  return [...'23456789', '_films', '-tv'].map(fit);
}
