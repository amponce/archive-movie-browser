# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com), newest first.

## [Unreleased]

### Changed

- Reuse successful Archive.org search responses for five minutes, keeping at most 100 in memory, so returning to a filter avoids another network request.

## [2.0.0] - 2026-09-22

The site becomes **Orphaned Films**. A new name, a front page, one design system, and television. Announced in [discussion #188](https://github.com/amponce/archive-movie-browser/discussions/188).

### Added

- A front page at `/`: tonight's film, hand-picked from `src/programme/featured.json` and rotated daily; what is on the channels; the most-watched horror; new uploads with posters; the lists as tiles with their own posters; one decade a day; a "wanted" count of films with no poster; "Continue watching" from the positions the player already keeps in your browser.
- **Television** at `/tv`. Every list is a channel that plays its lineup in order from a fixed moment, so the same film is on for everyone. Tune in mid-film, "From the start" to restart, ↑ ↓ to change channel, the next film starts on its own. A guide with a now-line. `public/tv-lineups.json` (built by `npm run tv`) holds each film's stream and length.
- The schedule as feeds: `/api/tv` (JSON with the live offset), `/api/tv/playlist.m3u`, `/api/tv/guide.xml` (XMLTV).
- Nine channels: 80s action, 80s horror, the stunts nobody would insure (Keaton), creature features, drive-in double features, Hitchcock before Hollywood and after, noir you can finish tonight, Saturday matinee westerns, silent but not quiet. All English-language, every film with a poster.
- Two lists (Hitchcock, 80s horror) on top of the three from before.
- A design system: tokens in `tailwind.config.js`, shapes in `src/index.css`, primitives in `src/ui/`, one header and footer in `src/layout/` on every page. `src/ui/README.md` explains the layers.
- Cast on the film page can be clicked to search that actor. Genre pills on the film page link into browse. "More like this" is its own query, so it appears however a film was opened.
- Vite serves the `api/` functions in development, so `npm run dev` runs everything.
- The poster index walks genre × decade (`--cross`), shows the model each candidate's original title, and gives the films it gave up on a second look with OMDb. 7,457 uploads decided.

### Changed

- The film browser moved from `/` to `/browse`. Every filter, the view toggle, the settings dialog and the type-ahead are unchanged; `/?genre=` and `/#film` links still work.
- One card per film: two uploads of the same film collapse to the better copy.
- The player plays at the top of the film page instead of below the cast.
- The hero poster, cards and lists use the new look; the generated covers (`TitleCover`) are still the art for films without a poster, inside the new frame.
- "Runs" was tried and rejected; they are lists. "Buster Keaton in an evening" is "The stunts nobody would insure".
- Site name, tagline ("Forgotten films, found"), page titles and the MCP banner.

### Kept on purpose

Every contributor's behaviour survived the redesign: `aria-pressed` on the toggles and screen-reader labels (#53), focus kept on Load more (#177), runtime snapping (#176), the year separator (#174), the `<dialog>` film page with its focus trap and Escape (#94), keyboard access to cards (#52, #172, #173), filters in the URL (#100), the remembered view mode (#110), the generated covers (#54, #98).

## [Unreleased]

## [2.1.0] - 2026-09-22

### Added

- **A channel of your own.** "Add to my channel" on any film page. Your films become channel 0 on the TV page, on the same clock as every other channel, and "Copy a link to it" gives a `/tv?mine=…` link that shows the same channel at the same minute to anyone. Kept in the browser, no account.
- **Sixteen generated stations**, for twenty-seven channels with the two new curated ones (Chaplin two reels at a time, Before the Code). Each station is a rule (a genre, a span of decades) picked from the index by `npm run stations`, posters and English only, re-picked every Monday by a workflow that opens a pull request.
- **Scrub preview** in the player. Hover the strip over the picture to see the frame and the time, click to go there. The frames are the per-minute thumbnails Archive.org already keeps.
- **Search by the film's real title.** The type-ahead matches the poster index's titles and original titles, so "Zombie Holocaust" finds the upload called "Zombi Holocaust 1980".
- The film page shows how long the upload itself runs, and says when it is a trailer or a clip of the film.
- MCP: `whats_on`, so an assistant can say what is on television and where to tune in.
- ESLint (undefined names, unused imports, hooks called wrong) in CI.

### Changed

- Continue watching: each film can be removed, trailers never qualify, and one or two films show as a line instead of a grid.
- The TV page: channels beside the screen, ending where it ends; one now-playing line; the guide under a rule.
- Browse is one link in the nav; it already opens on Horror. New Year's Evil is off the 80s action channel.
- A test refuses a list film that has not been measured (`npm run tv`), so a channel cannot silently lose films.
- The MCP's links point at orphanedfilms.com.

### Fixed

- Spin the reel on the browse page opens the film (the page now watches the hash).
- The header's search on every page is the type-ahead again.
- The stats page accepts a pasted key with quotes around it.

## [2.0.0] - 2026-09-22

The site becomes **Orphaned Films**. A new name, a front page, one design system, and television. Announced in [discussion #188](https://github.com/amponce/archive-movie-browser/discussions/188).

### Added

- A front page at `/`: tonight's film, hand-picked from `src/programme/featured.json` and rotated daily; what is on the channels; the most-watched horror; new uploads with posters; the lists as tiles with their own posters; one decade a day; a "wanted" count of films with no poster; "Continue watching" from the positions the player already keeps in your browser.
- **Television** at `/tv`. Every list is a channel that plays its lineup in order from a fixed moment, so the same film is on for everyone. Tune in mid-film, "From the start" to restart, ↑ ↓ to change channel, the next film starts on its own. A guide with a now-line. `public/tv-lineups.json` (built by `npm run tv`) holds each film's stream and length.
- The schedule as feeds: `/api/tv` (JSON with the live offset), `/api/tv/playlist.m3u`, `/api/tv/guide.xml` (XMLTV).
- Nine channels: 80s action, 80s horror, the stunts nobody would insure (Keaton), creature features, drive-in double features, Hitchcock before Hollywood and after, noir you can finish tonight, Saturday matinee westerns, silent but not quiet. All English-language, every film with a poster.
- Two lists (Hitchcock, 80s horror) on top of the three from before.
- A design system: tokens in `tailwind.config.js`, shapes in `src/index.css`, primitives in `src/ui/`, one header and footer in `src/layout/` on every page. `src/ui/README.md` explains the layers.
- Cast on the film page can be clicked to search that actor. Genre pills on the film page link into browse. "More like this" is its own query, so it appears however a film was opened.
- Vite serves the `api/` functions in development, so `npm run dev` runs everything.
- The poster index walks genre × decade (`--cross`), shows the model each candidate's original title, and gives the films it gave up on a second look with OMDb. 7,457 uploads decided.

### Changed

- The film browser moved from `/` to `/browse`. Every filter, the view toggle, the settings dialog and the type-ahead are unchanged; `/?genre=` and `/#film` links still work.
- One card per film: two uploads of the same film collapse to the better copy.
- The player plays at the top of the film page instead of below the cast.
- The hero poster, cards and lists use the new look; the generated covers (`TitleCover`) are still the art for films without a poster, inside the new frame.
- "Runs" was tried and rejected; they are lists. "Buster Keaton in an evening" is "The stunts nobody would insure".
- Site name, tagline ("Forgotten films, found"), page titles and the MCP banner.

### Kept on purpose

Every contributor's behaviour survived the redesign: `aria-pressed` on the toggles and screen-reader labels (#53), focus kept on Load more (#177), runtime snapping (#176), the year separator (#174), the `<dialog>` film page with its focus trap and Escape (#94), keyboard access to cards (#52, #172, #173), filters in the URL (#100), the remembered view mode (#110), the generated covers (#54, #98).

## [Unreleased]

### Added

- Sixteen generated stations, for twenty-five channels. Each is a rule (a genre, a span of decades) picked from the index by `npm run stations`, posters and English only, re-picked every Monday.
- The film page shows how long the upload itself runs, and says when it is a trailer or a clip of the film.
- Continue watching: each film can be removed, trailers never qualify, and one or two films show as a line instead of a grid.

### Fixed

- Spin the reel on the browse page opens the film (the page now watches the hash).
- The header's search on every page is the type-ahead again.
- The TV page: channels beside the screen, ending where it ends; one now-playing line; the guide under a rule.
- Browse is one link in the nav; it already opens on Horror.
- New Year's Evil is off the 80s action channel.

### Added

- Curated lists at `/lists`: hand-picked films with a line on each, as pages anyone can link to. A list is one JSON file in `src/lists/`, so adding one is a pull request with no code (see the README there). Three to start: noir under ninety minutes, Buster Keaton in an evening, drive-in double features.
- The poster index grew from 643 to 6,698 uploads and now follows what the app shows (the top of every genre pill and decade, not just each collection): the popular views went from 51% to 100% indexed, so almost every card gets its poster with no TMDB request. The film page says when the index identified an upload as a different film.
- Our own cookieless usage counts (`/api/event`, stored as counts in Redis) with a private stats page for the maintainer. See Privacy in the README.

### Changed

- When the same film is uploaded more than once, the list keeps the sharper or larger copy instead of whichever upload was downloaded most ([#118](https://github.com/amponce/archive-movie-browser/issues/118)).
- The collection dropdown and the genre pills always both apply. A genre used to switch to every film collection while the dropdown kept showing the old one. **All Films** is a new choice and the default; a search shows "Everything (searching)".
- The MCP page and the stats page are part of the React app now (`/mcp`, `/stats`); the old `.html` addresses redirect.
- Genre lives in the pills only: the collection dropdown no longer lists Film Noir or Sci-Fi & Horror (links to them open All Films with the matching pill), and the Film Noir pill includes the curated Film Noir collection.
- The site opens on Horror in All Films, where the most striking posters are. All Genres is one click away and is kept in the URL (`?genre=all`); picking another library shows all of it.
- A list that has reached its end says so, and offers to look in All Films with the same filters.
- The rules for filters in the URL moved into `src/services/urlFilters.js`, with tests ([#145](https://github.com/amponce/archive-movie-browser/pull/145)).

### Fixed

- Every browse and search now leaves out the sub-collections that are not films: the trailer bin (60,246 of the 110,772 items in the film collections), stock footage, home movies and numbered digitisation reels. The 2020s view used to open on reels titled "133"; it now opens on films. Shorts keeps the trailer bin.
- "Release Date (Newest)" was letting 2026-dated uploads through: the guard against upload dates was long enough that Archive.org truncated it. It is now compact.

## [1.3.0] - 2026-09-21

### Added

- Our own film player: arrow keys skip 10 s (Shift: a minute), Space pauses, F is full screen, M mutes, Escape closes, and a film resumes where you left it. Archive.org's player remains the fallback ([#137](https://github.com/amponce/archive-movie-browser/pull/137)).
- An MCP server for the catalogue, run locally ([#112](https://github.com/amponce/archive-movie-browser/pull/112)) or hosted at `/api/mcp` ([#133](https://github.com/amponce/archive-movie-browser/pull/133)), with a page explaining it ([#130](https://github.com/amponce/archive-movie-browser/pull/130)).
- Decade filter, 1910s to 2020s ([#128](https://github.com/amponce/archive-movie-browser/pull/128), [#132](https://github.com/amponce/archive-movie-browser/pull/132)).
- Paste an Archive.org link into the search box to open it here ([#136](https://github.com/amponce/archive-movie-browser/pull/136)).
- Search suggestions include the tags uploaders use ([#138](https://github.com/amponce/archive-movie-browser/pull/138)).
- Search from the film page without going back ([#139](https://github.com/amponce/archive-movie-browser/pull/139)), and clear recent searches ([#140](https://github.com/amponce/archive-movie-browser/pull/140)).
- Grid or list view is remembered between visits ([#110](https://github.com/amponce/archive-movie-browser/pull/110)).
- A security policy with private vulnerability reporting ([#113](https://github.com/amponce/archive-movie-browser/pull/113)).

### Changed

- Release-date sorts leave out dates that are really upload dates, so "newest" is truthful ([#128](https://github.com/amponce/archive-movie-browser/pull/128), [#132](https://github.com/amponce/archive-movie-browser/pull/132)).
- Most Popular shows films with a real poster first ([#132](https://github.com/amponce/archive-movie-browser/pull/132)).

### Fixed

- Top Rated (TMDB) no longer reshuffles cards as ratings arrive, and Load more adds films in place ([#127](https://github.com/amponce/archive-movie-browser/pull/127)).
- Trailers and clips no longer appear under Full Movies ([#128](https://github.com/amponce/archive-movie-browser/pull/128), [#129](https://github.com/amponce/archive-movie-browser/pull/129)).
- On phones, the selected genre scrolls into view ([#125](https://github.com/amponce/archive-movie-browser/pull/125)).

## [1.2.0] - 2026-09-21

### Added

- Added shareable views with filters and searches stored in the URL ([#100](https://github.com/amponce/archive-movie-browser/pull/100)).
- Added a keyhole generated poster for films without artwork ([#98](https://github.com/amponce/archive-movie-browser/pull/98)).
- Added a mobile layout that shows films first ([#99](https://github.com/amponce/archive-movie-browser/pull/99)).

### Changed

- Refreshed the poster index with 75 additional uploads ([#90](https://github.com/amponce/archive-movie-browser/pull/90)).
- Updated the header and footer to reflect the collection being browsed ([#91](https://github.com/amponce/archive-movie-browser/pull/91)).

### Fixed

- Fixed movie card callbacks being recreated across parent renders ([#93](https://github.com/amponce/archive-movie-browser/pull/93)).
- Fixed focus handling in the movie detail dialog ([#94](https://github.com/amponce/archive-movie-browser/pull/94)).
- Improved poster matching for catalogue-prefixed titles ([#95](https://github.com/amponce/archive-movie-browser/pull/95)).
- Bounded and improved expiration of the TMDB cache ([#96](https://github.com/amponce/archive-movie-browser/pull/96)).

## [1.1.0] - 2026-09-20

### Added

- Added search suggestions with word-based matching ([#73](https://github.com/amponce/archive-movie-browser/pull/73)).
- Added generated posters for films without posters ([#59](https://github.com/amponce/archive-movie-browser/pull/59)).
- Added accessibility improvements for filters, movie cards, and the detail page ([#52](https://github.com/amponce/archive-movie-browser/pull/52), [#53](https://github.com/amponce/archive-movie-browser/pull/53)).
- Added security headers, social preview tags, and Dependabot configuration ([#74](https://github.com/amponce/archive-movie-browser/pull/74)).

### Changed

- Added a poster index to improve poster matching without requiring a TMDB API key ([#89](https://github.com/amponce/archive-movie-browser/pull/89)).
- Upgraded the project to React 19 and Vite 8 ([#87](https://github.com/amponce/archive-movie-browser/pull/87)).

### Fixed

- Improved matching of messy Archive.org upload titles to films ([#59](https://github.com/amponce/archive-movie-browser/pull/59)).
- Improved TMDB request handling and caching ([#56](https://github.com/amponce/archive-movie-browser/pull/56)).
- Fixed detail-page posters and movie accessibility issues ([#71](https://github.com/amponce/archive-movie-browser/pull/71)).

## [1.0.0] - 2026-09-20

### Added

- Added browsing across Archive.org film collections with genre filtering ([#2](https://github.com/amponce/archive-movie-browser/pull/2), [#5](https://github.com/amponce/archive-movie-browser/pull/5)).
- Added search across collections and support for films without recorded runtime ([#5](https://github.com/amponce/archive-movie-browser/pull/5)).
- Added generated title covers for films without posters ([#7](https://github.com/amponce/archive-movie-browser/pull/7)).
- Added shareable film links and improved detail-page navigation ([#20](https://github.com/amponce/archive-movie-browser/pull/20)).
- Added automated retries for transient Archive.org errors ([#27](https://github.com/amponce/archive-movie-browser/pull/27)).
- Added CI, tests, and an MIT license ([#24](https://github.com/amponce/archive-movie-browser/pull/24)).

### Changed

- Improved filtering, pagination, and search behavior ([#4](https://github.com/amponce/archive-movie-browser/pull/4)).
- Improved handling of duplicate uploads by collapsing re-uploads of the same film ([#7](https://github.com/amponce/archive-movie-browser/pull/7)).

### Fixed

- Fixed broken filters and updated the logo ([#1](https://github.com/amponce/archive-movie-browser/pull/1)).
- Fixed runtime and collection filtering issues ([#23](https://github.com/amponce/archive-movie-browser/pull/23), [#28](https://github.com/amponce/archive-movie-browser/pull/28)).
