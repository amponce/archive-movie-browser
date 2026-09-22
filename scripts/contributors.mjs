#!/usr/bin/env node
// Rewrites the contributors block in README.md: every person with a merged pull request,
// ranked by how many, with their avatar and the count. Needs the GitHub CLI (gh) signed in.
//
//   npm run contributors
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = 'amponce/archive-movie-browser';
const START = '<!-- contributors:start -->';
const END = '<!-- contributors:end -->';

const logins = JSON.parse(execFileSync('gh', ['pr', 'list', '--repo', REPO, '--state', 'merged', '--limit', '1000', '--json', 'author'], { encoding: 'utf8' }))
  .map(pr => pr.author.login)
  .filter(login => !login.startsWith('app/') && login !== 'amponce'); // bots and the maintainer are not contributors

const counts = new Map();
for (const login of logins) counts.set(login, (counts.get(login) || 0) + 1);
const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

const cell = ([login, n]) => `<a href="https://github.com/${REPO}/pulls?q=is%3Apr+is%3Amerged+author%3A${login}" title="${login}: ${n} merged pull request${n === 1 ? '' : 's'}"><img src="https://github.com/${login}.png?size=72" width="72" height="72" alt="${login}" style="border-radius:50%"></a><br><sub><b>${login}</b><br>${n} PR${n === 1 ? '' : 's'}</sub>`;
const rows = [];
for (let i = 0; i < ranked.length; i += 6) rows.push(`<tr>${ranked.slice(i, i + 6).map(r => `<td align="center" valign="top" width="16%">${cell(r)}</td>`).join('')}</tr>`);
const block = `${START}\n<table><tbody>\n${rows.join('\n')}\n</tbody></table>\n${END}`;

const readme = fs.readFileSync('README.md', 'utf8');
const a = readme.indexOf(START); const b = readme.indexOf(END);
if (a < 0 || b < 0) { console.error('README.md has no contributors markers'); process.exit(1); }
fs.writeFileSync('README.md', readme.slice(0, a) + block + readme.slice(b + END.length));
console.log(`${ranked.length} contributors, ${logins.length} merged pull requests. README.md updated.`);
