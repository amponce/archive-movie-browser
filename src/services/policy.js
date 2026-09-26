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

// Films that never go on a TV channel, by TMDB id (every upload of the film). Still searchable.
const NEVER_ON_AIR = new Set([
  39266,
]);
export const neverOnAir = tmdbId => NEVER_ON_AIR.has(Number(tmdbId));

// 3. What never appears here, whoever searches for it and however it is linked. The site mirrors
//    the Archive, adult films included, but not: anything sexual involving children; sexual
//    violence; footage of real killing; hate material. Checked on every result (title, tags,
//    description), every opened film and every search, in one place so all surfaces agree.
//    Words are matched whole, on text lowercased with accents and punctuation folded away.
const fold = text => ` ${String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[*@]/g, 'a').replace(/[^a-z0-9]+/g, ' ')} `;
const any = words => new RegExp(` (${words.join('|')}) `);

// Children in any sexual context: forbidden outright, in any field
const CHILD_ABUSE = any(['lolicon', 'loli', 'lolis', 'shotacon', 'shota', 'jailbait', 'underage', 'under age', 'preteens?', 'pre teens?', 'pedo\\w*', 'paedo\\w*', 'child porn\\w*', 'kiddie porn', 'kiddy porn', 'csam', 'maladolescenza']);
const CHILD = any(['child', 'children', 'kids?', 'minors?', 'schoolgirls?', 'schoolboys?', 'little girls?', 'little boys?', 'young girls?', 'young boys?', '\\d{1,2} ?(yo|y o|years? old)']);
// Adult or sexual context
const SEXUAL = any(['sex', 'sexy', 'sexual', 'nude', 'nudes', 'nudity', 'naked', 'porn\\w*', 'xxx', 'erotic\\w*', 'hentai', 'nsfw', 'lewd', 'fetish\\w*', 'strip\\w*', 'adult', 'adults only', 'explicit', 'hardcore', 'softcore', 'uncensored']);
// Sexual violence, real killing, hate: forbidden in a title, the tags or a search, and in a
// description when it comes with adult content (a drama's synopsis may name its subject)
const SEXUAL_VIOLENCE = any(['rape', 'rapes', 'raped', 'raping', 'rapist', 'noncon', 'non con', 'non consensual', 'nonconsensual', 'forced sex', 'sex slave', 'sex slaves', 'molest\\w*']);
const REAL_KILLING = any(['snuff', 'beheading', 'beheadings', 'beheaded', 'execution video', 'executions video', 'real death', 'real deaths', 'death footage', 'gore compilation', 'liveleak', 'murder video', 'suicide video', 'shooting video']);
const HATE = any(['white power', 'white power bands?', 'white pride', 'white pride world wide', 'wpww', 'nazi skinheads?', 'rock against communism', 'blood and honour', 'combat 18', 'nsbm', 'race war', 'rahowa', '14 words', 'fourteen words', 'skrewdriver', 'holocaust hoax', 'jihadi nasheed', 'jihad nasheed', 'isis propaganda', 'islamic state video', 'niggers?', 'nigga', 'kikes?', 'faggots?', 'chinks?', 'wetbacks?']);

export function isForbidden({ title, description, tags, subject } = {}) {
  // A title and its tags say what an upload is; a description may only be about it
  const named = fold([Array.isArray(title) ? title[0] : title, ...[].concat(tags || []), ...[].concat(subject || [])].join(' ; '));
  const described = fold(description);
  const all = `${named}${described}`;
  if (CHILD_ABUSE.test(all)) return true;
  if (CHILD.test(all) && SEXUAL.test(all)) return true;
  for (const words of [SEXUAL_VIOLENCE, REAL_KILLING, HATE]) {
    if (words.test(named)) return true;
    if (words.test(described) && SEXUAL.test(all)) return true;
  }
  return false;
}

// A search asking for any of it is answered with nothing and not sent to Archive.org. Whatever a
// search does return still passes isForbidden, so a spelling this misses still finds nothing here.
export function isForbiddenSearch(text) {
  const words = fold(text);
  return [CHILD_ABUSE, SEXUAL_VIOLENCE, REAL_KILLING, HATE].some(r => r.test(words)) || (CHILD.test(words) && SEXUAL.test(words));
}
