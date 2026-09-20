# Contributing

Thanks for being here. This project browses and plays public domain films from the Internet Archive, and it is open to anyone who wants to make it better: code, tests, accessibility, design, or curating films.

## Find something to do

- [Good first issues](https://github.com/amponce/archive-movie-browser/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) are small, scoped, and have file and line references.
- [Help wanted](https://github.com/amponce/archive-movie-browser/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) issues are bigger pieces.
- Have your own idea? Open an issue first and describe it. New directions are welcome; a short conversation up front saves you from building something that can't be merged.

Comment on an issue before you start so two people don't do the same work. No need to wait for a reply on a good first issue.

## Set up

```bash
git clone https://github.com/<you>/archive-movie-browser.git
cd archive-movie-browser
npm install
npm run dev
```

Node 22 or newer. A TMDB key is optional: without one the app works and shows title covers instead of posters (see the README).

## Before you open a pull request

1. `npm test` passes.
2. `npm run build` passes.
3. **Click through the change in a browser.** A passing build does not catch a page that crashes when you open it, and there are no component tests yet. Open a film, close it, change a filter.
4. Logic in `src/services/` has tests in `src/services/archive.test.js` (`node:test`, no extra dependencies). Add or update tests when you change behaviour there.

Keep a PR to one thing. Small PRs get reviewed and merged quickly; a PR that also reformats a file or renames things takes much longer.

## What review looks like

- CI runs the tests and the build on every PR. On your first PR, GitHub waits for a maintainer to approve the run; that is a GitHub safety default, not a judgement on you.
- A maintainer reads the diff, runs the branch, and tries it in a browser. Feedback will be specific. If the fix is tiny we may push it to your branch ourselves rather than send you round again.
- Merged contributors are credited in the README and in the release notes.

Changes to dependencies, `package.json`, build configuration, or anything under `.github/` need the maintainer's sign-off and take longer. If your change needs a new dependency, say why in the issue first; most things here are done without one.

## Using AI tools

Fine, and common. You are responsible for what you submit: run it, test it, and be able to explain it. PRs that were clearly never run get closed.

## Be decent

Be kind and assume good intent. See the [Code of Conduct](CODE_OF_CONDUCT.md).
