// What the site will show. Two rules, used everywhere a film can appear.
//
// 1. Takedowns. An upload named here never appears on this site: not in search, on a film page,
//    in a row, on TV, in a list, or through the MCP server. Add one entry per notice received
//    (see /takedown); the files themselves are the Internet Archive's to remove.
//    The first entry is a test fixture (no such upload exists) that keeps every surface honest.
export const TAKEN_DOWN = [
  { id: 'orphanedfilms-takedown-test', date: '2026-09-23', reason: 'test fixture: proves every surface honours this list' },
];
const taken = new Set(TAKEN_DOWN.map(t => t.id));
export const isTakenDown = id => taken.has(String(id || ''));

// 2. Recent films stay off what the site shows on its own (the front page, TV, lists, More like
//    this). Anything from the last 25 years is likely still in copyright, whoever uploaded it.
//    Search and browse still find everything the Archive hosts: this site is a mirror.
export const RECENT_YEARS = 25;
export const isRecent = (year, now = new Date()) => Number(year) > now.getFullYear() - RECENT_YEARS;
