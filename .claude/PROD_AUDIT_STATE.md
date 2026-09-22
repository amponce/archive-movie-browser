# Production-readiness audit: state

The memory of the audit loop. Agents write here as they go. The conversation does not survive; this file does.

Last full pass: 1 (2026-09-22, 8c799a8): 23 surfaces, 132 criteria, 112 passed, 24 findings
Passes run: 1 (read-only half; no fixer run yet)

## Surfaces
| surface | files | inventoried@ | status | summary |
|---|---|---|---|---|
| Home/browse (landing = All Films + Horror pill) | src/App.jsx, src/components/ArchiveMovieBrowser.jsx, src/hooks/useFilms.js, src/components/MovieCard.jsx, src/services/archive.js | 8c799a8 | untested | |
| Filters (dropdown, pills, decade, runtime, sort, Shorts) | src/components/ArchiveMovieBrowser.jsx, src/hooks/useFilms.js, src/services/sorting.js, src/services/archive.js, src/services/urlFilters.js | 8c799a8 | untested | |
| Search box (type-ahead, tags, recent + clear, pasted Archive links) | src/components/SearchBox.jsx, src/services/suggest.js, src/services/archiveUrl.js, src/components/ArchiveMovieBrowser.jsx | 8c799a8 | untested | |
| Film page (dialog, focus, history, related, search bar) | src/components/MovieDetailPage.jsx, src/services/movieMatching.js, src/components/SearchBox.jsx | 8c799a8 | untested | |
| Own player (shortcuts, resume, fallback iframe) | src/components/FilmPlayer.jsx, src/services/playback.js | 8c799a8 | untested | |
| Load more / end of list | src/hooks/useFilms.js, src/components/ArchiveMovieBrowser.jsx | 8c799a8 | untested | |
| URL state (share, reload, Back/Forward, old links) | src/services/urlFilters.js, src/components/ArchiveMovieBrowser.jsx, src/components/MovieDetailPage.jsx, vercel.json (rewrites/redirects) | 8c799a8 | untested | |
| Phone layout (390px) | src/components/ArchiveMovieBrowser.jsx, src/components/MovieDetailPage.jsx, src/components/SearchBox.jsx, src/components/McpBanner.jsx, src/index.css, tailwind.config.js | 8c799a8 | untested | |
| Keyboard + screen reader (dialog, combobox, pills) | src/components/MovieDetailPage.jsx, src/components/SearchBox.jsx, src/components/ArchiveMovieBrowser.jsx, src/components/FilmPlayer.jsx, src/components/MovieCard.jsx | 8c799a8 | untested | |
| Generated covers | src/components/TitleCover.jsx, src/services/coverDesign.js, src/components/MovieCard.jsx | 8c799a8 | untested | |
| Poster index + TMDB fallback | src/services/posterIndex.js, src/services/tmdb.js, public/poster-index.json, scripts/build-poster-index.mjs, .github/workflows/poster-index.yml, src/components/SettingsModal.jsx | 8c799a8 | untested | |
| MCP banner | src/components/McpBanner.jsx, src/components/ArchiveMovieBrowser.jsx | 8c799a8 | untested | |
| /mcp page | src/pages/McpPage.jsx, src/App.jsx, vercel.json (rewrite) | 8c799a8 | untested | |
| /stats page (gate) | src/pages/StatsPage.jsx, src/App.jsx, vercel.json (rewrite) | 8c799a8 | untested | |
| /api/mcp (tools, CORS, rate limit, cache) | api/mcp.js, mcp/tools.mjs, api/_redis.js, mcp/http.test.mjs, vercel.json (functions) | 8c799a8 | untested | |
| /api/event (validation, origin check, bot filter, rate limit) | api/event.js, api/_stats.js, api/_redis.js, src/services/analytics.js, mcp/event.test.mjs | 8c799a8 | untested | |
| /api/stats (auth) | api/stats.js, api/_stats.js, api/_redis.js, mcp/stats.test.mjs | 8c799a8 | untested | |
| Security headers / CSP | vercel.json (headers), index.html | 8c799a8 | untested | |
| Error states (Archive.org 502/timeout, offline) | src/services/archive.js, src/hooks/useFilms.js, src/components/ArchiveMovieBrowser.jsx, src/services/tmdb.js, src/services/posterIndex.js | 8c799a8 | untested | |
| Performance (bundle size, first load, TMDB request count) | vite.config.js, src/main.jsx, src/App.jsx, src/services/tmdb.js, src/services/posterIndex.js, index.html | 8c799a8 | untested | |
| README / CONTRIBUTING accuracy | README.md, CONTRIBUTING.md, mcp/README.md, CHANGELOG.md, SECURITY.md, .env.example | 8c799a8 | untested | |
| CI | .github/workflows/ci.yml, .github/workflows/poster-index.yml, .github/dependabot.yml, package.json, mcp/package.json | 8c799a8 | untested | |
| Local MCP server (added: found in mcp/) | mcp/server.mjs, mcp/register.mjs, mcp/tools.mjs, mcp/server.test.mjs, mcp/README.md | 8c799a8 | untested | |
| Settings modal / TMDB status (added: found in src/) | src/components/SettingsModal.jsx, src/components/ArchiveMovieBrowser.jsx | 8c799a8 | untested | |

## Findings
| id | surface | severity | status | defect | reproduction (command/script; observed vs expected) | pass |
|---|---|---|---|---|---|---|
| F1 | /api/event | S2 | open | `Origin: null` or any non-URL Origin makes the function throw: 500 instead of 403 | `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Origin: null' -H 'User-Agent: Mozilla/5.0' -d '{"name":"Load more"}' https://www.orphanedfilms.com/api/event` -> 500 (3/3, both hosts); expected 403. Cause: unguarded `new URL(origin)` at api/event.js:22 | 1 |
| F2 | /api/event | S3 | needs-repro | per-IP 60/min limit never fired in one run | 66 sequential POSTs of `{"name":"nope"}` from one IP -> 66x400, 0x429; /api/mcp hit 429 at ~47 with the same shape. Likely per-instance `hits` spread across warm instances | 1 |
| F3 | /api/mcp | S4 | open | canonical/og:url, MCP `watchUrl` (`SITE` in mcp/tools.mjs:12), /mcp page and README all point at archive-movie-browser.vercel.app; `orphanedfilms` appears nowhere in the repo; vercel.app serves 200 rather than redirecting | `grep -rn vercel.app index.html src/pages/McpPage.jsx mcp/tools.mjs README.md` -> 5 hosts; `curl -sI https://archive-movie-browser.vercel.app/` -> 200 | 1 |
| F4 | Film page | S3 | open | Browser Forward after closing a film restores `#id` but not the film; the next card opened carries the previous film's hash, so Share/Reload opens the wrong film | `node wk/repro2.mjs`: open A, Esc, Forward -> no dialog, hash still A; click card B -> B shown with A's hash; reload -> A. Cause: MovieDetailPage skips pushState when history.state.movieDetail is set; popstate never opens a film | 1 |
| F5 | Search box | S4 | open | Pasted-link error blames the address when Archive.org is down (502) | `node wk/search502.mjs` C7: metadata 502 -> "Check the address: nothing was found". Expected: distinguish outage from not-found, offer retry | 1 |
| F6 | Search box | S4 | open | 2500-char query (no maxLength) yields bare "Error: Failed to fetch" | `node wk/search502.mjs` C6: x*2500 + Enter -> "Error: Failed to fetch", URL 2.5 KB | 1 |
| F7 | Film page | S4 | open | Unknown `#identifier` link fails silently: no message, hash stays | load `/#no_such_item_zz_987` -> no dialog, no alert, only console.error. Expected: the pasted-link alert and a cleared hash | 1 |
| F8 | Load more | S3 | open | Enter on "Load more" drops keyboard focus to `<body>` (the button is disabled while loading, so browsers blur it); after the batch arrives a keyboard/screen-reader user must Tab through the whole grid again, with no announcement | `node wk/filt6.mjs`, `wk/live-focus.mjs`: focus BUTTON -> BODY 300 ms after Enter, still BODY after load (chromium + webkit, local + live). Expected: focus stays on the button or moves to the first new card | 1 |
| F9 | Load more | S3 | open | When a batch yields 0 films but Archive.org has more pages (all filtered client-side), the page shows "No movies found" + widen button AND a Load more button together; clicking Load more with 0 cards gives no visible feedback | `node wk/filt6.mjs` mock (numFound 1000, every doc 1 min) at `?collection=feature_films&genre=all&runtime=90`: cards 0, empty state true, Load more present, unchanged after click. Cause: empty state keys on movies.length===0 (ArchiveMovieBrowser.jsx:633) while Load more keys on nextPage (:653) | 1 |
| F10 | Filters | S4 | open | Hand-edited `?runtime=299` is applied ("299+ min" in stats) but the runtime select shows "Any length" | `node wk/rt299.mjs`: select "Any length", stats "299+ min runtime". Expected: snap to a listed option | 1 |
| F11 | Filters | S4 | open | Landing view shows "Horror Express" three times (metadata years 1973, 1976, 1972); the dedupe rule keeps same-title uploads whose years differ, so uploader-typo years defeat it on the most visible page | `node wk/filt2.mjs`: 42 cards, 41 unique titles; dup years 1973/1976/1972, two at 87 min | 1 |
| F12 | Settings modal | S2 | open | Settings modal is not a dialog for keyboard/AT users: no role=dialog/aria-modal, focus stays on the opener, Tab goes behind the overlay, Escape does not close, the X button has no accessible name | `wk/p1kb.mjs` + live: open via Enter on the gear -> 4 Tabs reach Search/Collection/Full Movies behind it; Escape leaves it open; X aria-label null. Expected: the film dialog's treatment (focus in, trap, Escape, labelled close) | 1 |
| F13 | Settings modal | S3 | open | Gear says "Configure TMDB API / Click to configure" but the modal is read-only, and its no-key copy tells visitors to edit .env and restart the dev server | `wk/p1kb.mjs`: modal has 0 inputs; SettingsModal.jsx renders "Add VITE_TMDB_API_KEY to your .env file" for end users. Expected: a status label, no dev instructions on the public site | 1 |
| F14 | Keyboard | S3 | open | Related-film cards in the dialog ignore Space, and their accessible name runs title and year together ("Escape by Night1937") | `wk/p1kb.mjs`: focus first `dialog [role=button]`, Space -> nothing (both engines). MovieDetailPage.jsx:51 checks Enter only; no aria-label | 1 |
| F15 | Keyboard | S4 | open | Combobox keeps aria-activedescendant pointing at a removed option after Escape | `wk/p1kb.mjs`: type, ArrowDown, Escape -> aria-expanded=false but aria-activedescendant still set to a missing id | 1 |
| F16 | Generated covers | S4 | open | Card meta shows a stray "•" when a film has a runtime but no year | `scratchpad/p1-covers-chromium.png` "Dr. Sex." card: "• 1h 3m". MovieCard.jsx renders the separator unconditionally | 1 |
| F17 | Error states | S3 | open | A hung Archive.org request never times out: spinner forever, no error, no Try again | `node wk/hang.mjs` (route advancedsearch to never respond): after 40 s `{loading:true, tryAgain:false}` chromium + webkit, 3 runs. src/services/archive.js:457 passes no signal on page loads. Expected: AbortSignal.timeout surfacing the error box | 1 |
| F18 | Performance | S3 | open | Hashed bundles and poster-index.json are served with `max-age=0, must-revalidate`; every repeat visit revalidates ~130 KB | `curl -sI https://www.orphanedfilms.com/assets/index-BOb7uwgM.js` -> `cache-control: public, max-age=0, must-revalidate`. The `/(.*)` header block in vercel.json replaces Vercel's default. Expected `max-age=31536000, immutable` on hashed assets | 1 |
| F19 | README | S3 | open | Privacy section says "counts only", but the last 50 individual events (timestamp, search text, film id, path, referrer) are stored and returned (the recent feed added in #156); CHANGELOG repeats it | `api/_stats.js` LPUSH stats:recent; `/api/stats` -> `recent` with 40 entries. Expected: README states that a short, expiring feed of recent events is kept too | 1 |
| F20 | /mcp, /stats pages | S4 | open | Trailing-slash addresses 404 in production (Vercel 404 page, whose inline script trips our CSP); local build serves the page | `curl -o /dev/null -w %{http_code} https://www.orphanedfilms.com/mcp/` -> 404; same /stats/. Expected: rewrite or redirect | 1 |
| F21 | README | S4 | open | Project Structure tree is stale: omits src/hooks, src/pages, api/, FilmPlayer, McpBanner and 5 of 11 services | README.md:121-140 vs `ls src/services src/components src/pages src/hooks api` | 1 |
| F22 | README | S4 | open | "Make It Yours: change the initial category state in ArchiveMovieBrowser.jsx" points at the wrong file | default is `collection: ALL_FILMS` in src/services/urlFilters.js:23 | 1 |
| F23 | CONTRIBUTING | S4 | open | Says services are tested in `src/services/archive.test.js` only; no mention of `npm test --prefix mcp`, where api/*.js is tested | 11 test files exist; CI runs both suites | 1 |
| F24 | CI | S4 | open | CI triggers only on pull_request; main never gets a run, so a red PR merged by mistake (#152) leaves no signal on main | `.github/workflows/ci.yml` on: pull_request; `gh run list --branch main` shows only Dependabot runs. Expected: also push to main | 1 |


## Clusters
| id | slug | findings | root cause | rank | decision | PR | status |
|---|---|---|---|---|---|---|---|
| C1 | event-origin-500 | F1 | api/event.js:22 calls `new URL(origin)` unguarded, so `Origin: null` / a non-URL Origin throws (500) before the 403 branch | 1 | fix-now | | pending |
| C2 | settings-modal-dialog | F12, F13 | SettingsModal.jsx is a plain div overlay (no `<dialog>`, focus move, trap, Escape or labelled close) that still carries dev-only "add the key to .env" copy; the gear in ArchiveMovieBrowser.jsx:350 promises "Configure" | 2 | fix-now | | pending |
| C3 | film-history-forward | F4 | MovieDetailPage.jsx:116 skips pushState when `history.state.movieDetail` is already set and its popstate handler (:157) only closes; nothing reopens a film on Forward, so the stale `#id` leaks into the next card's history entry | 3 | fix-now | | pending |
| C4 | load-more-states | F8, F9 | ArchiveMovieBrowser.jsx:633-664 derives the empty state from `movies.length`, Load more from `nextPage`, and sets `disabled={loading}` on the button, so focus drops to body and both blocks render at once on an all-filtered batch | 4 | fix-now | | pending |
| C5 | archive-fetch-timeout | F17 | archive.js:457 `fetchMovies` fetches with no timeout and useFilms.js:33 passes no signal, so a hung Archive.org request never rejects into `error` | 5 | fix-now | | pending |
| C6 | related-card-keyboard | F14 | MovieDetailPage.jsx:46-52 `RelatedMovieCard` handles Enter only (no Space) and has no aria-label, so the year `<p>` concatenates into the accessible name | 6 | fix-now | | pending |
| C7 | docs-stale | F19, F21, F22, F23 | README.md (privacy :171, structure :121-140, Make It Yours), CONTRIBUTING.md:29 and CHANGELOG.md were not updated for #145-#158 (recent-events feed, src/hooks, src/pages, api/, urlFilters default, `npm test --prefix mcp`) | 7 | fix-now | | pending |
| C8 | asset-cache-headers | F18 | vercel.json `/(.*)` headers block replaces Vercel's default cache-control, so hashed /assets and poster-index.json ship `max-age=0, must-revalidate` | 8 | defer (vercel.json headers: maintainer sets the cache policy, e.g. `max-age=31536000, immutable` on /assets/(.*) and a short max-age on poster-index.json) | | pending |
| C9 | canonical-host | F3 | index.html:9,14,15, src/pages/McpPage.jsx:4, mcp/tools.mjs:12 (`SITE`) and README.md:8 hardcode archive-movie-browser.vercel.app; vercel.app serves 200 instead of redirecting | 9 | defer (maintainer decides the canonical host, orphanedfilms.com vs vercel.app, and the vercel.app->www redirect in Vercel domain settings; then the five strings follow) | | pending |
| C10 | open-by-identifier-errors | F5, F7 | ArchiveMovieBrowser.jsx: the hash path (:63-69) swallows `getMovieByIdentifier` errors to console, the pasted-link path (:94) calls every failure "nothing was found", and archive.js `getMetadata` (:552) throws the same Error for 404 and 502 | 10 | fix-now | | pending |
| C11 | trailing-slash | F20 | vercel.json rewrites match `/mcp` and `/stats` exactly and no `trailingSlash` setting exists, so `/mcp/` falls through to the Vercel 404 page | 11 | fix-now | | pending |
| C12 | landing-dedupe-years | F11 | archive.js `fetchFiltered` :526-530 keeps same-title uploads whenever both metadata years differ, so mistyped years defeat the dedupe on the landing view | 12 | defer (product direction: the year rule is deliberate for The Bat 1926/1959; maintainer picks a tie-break, e.g. same title and runtime within 2 min counts as one film) | | pending |
| C13 | search-query-length | F6 | SearchBox.jsx:163 input has no maxLength and `handleSearch` (ArchiveMovieBrowser.jsx:129) sends any length, so Archive.org rejects the URL and archive.js surfaces a raw "Failed to fetch" | 13 | fix-now | | pending |
| C14 | runtime-param-snap | F10 | urlFilters.js:64-66 `parseFilters` accepts any 0-300 runtime while the select (ArchiveMovieBrowser.jsx:466-471) lists six values, so a value off the list is applied but not displayed | 14 | fix-now | | pending |
| C15 | combobox-activedescendant | F15 | SearchBox.jsx:151-155 Escape sets `open=false` but not `active=-1`, so aria-activedescendant (:170) keeps pointing at a removed option | 15 | fix-now | | pending |
| C16 | card-meta-separator | F16 | MovieCard.jsx:124 grid view renders the "•" whenever `runtimeMinutes > 0`, not only when a year precedes it | 16 | fix-now | | pending |
| C17 | ci-push-main | F24 | .github/workflows/ci.yml:3-4 triggers on `pull_request` only, so main never gets a run | 17 | defer (.github/: maintainer adds `push: branches: [main]`) | | pending |

## Pass log
| pass | date | surfaces tested | findings added | clusters fixed / verified / blocked | PRs |
|---|---|---|---|---|---|
| 1 | 2026-09-22 | 23 (all) at 8c799a8 | 24 (0 S1, 2 S2, 9 S3, 13 S4; F2 needs-repro) | 0 / 0 / 0 (fix phase not run: maintainer reviewing results first) | none |

## Tooling
- Scratchpad browser scripts (Playwright): see `.claude/skills/prod-audit/SKILL.md`. If the scratchpad is gone, recreate `serve-with-headers.mjs` and install Playwright's chromium + webkit before testing.
- Merge gate for the maintainer: `ship.sh` (refuses red CI). Agents never merge.
