# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com), newest first.

## [Unreleased]

### Added

- An Archive.org collection RSS feed (`archive.org/services/collection-rss.php?collection=…`) pasted or swapped onto this site opens that collection, newest first, which is what the feed lists.
- Subtitles. The film player loads the subtitle files an uploader included, through `/api/subtitles` (Archive.org won't serve them to other sites), converted to WebVTT with old Windows-1252 files read correctly. Labelled by language from the file name, English on by default, the rest and Archive.org's auto captions in the player's captions menu. Most foreign films on Archive.org have their subtitles burned into the picture or none at all; about one in ten has a file.

## [2.2.0] - 2026-09-23

### Added

- Pop out: the TV set, a channel opened in the guide, and the film player can float in their own picture-in-picture window over other apps. On TV the window stays open when the next film starts.
- Any Archive.org collection opens as a browse of that collection, from a pasted link or `/details/<collection>` (Community Video, Home Movies, thousands more), on all genres and with its own name in the dropdown. `archive.org/details/movies`, the whole Moving Image Archive, opens as All of Archive.org, without the TV news clips; it's mostly not films, so it isn't in the dropdown.
- Any Archive.org address works on this site: swap `archive.org` for `orphanedfilms.com` (`/details/hexziasmovies`, `/details/@someone/lists/1/…`). A link to one file inside an upload (`/details/hexziasmovies/Annabelle+Comes+Home.mp4`) plays that film. Someone's Archive.org list opens as a page of its films, read from Archive.org each visit and not kept here, with Add to my channel on each film and Watch this list as a channel.
- Pasting an Archive.org upload that holds many films (some people keep a list of films in one upload) shows each film with its poster, and picking one plays that file. Read from Archive.org each time; nothing is kept on our side.
- MCP clients can attach catalogue and film resources, and use a `movie_night` prompt for three picks suited to their mood and available time.
- The front page's lead changes category every week (Westerns, Cult 80s, Noir, Horror, Silent and early, Drive-in sci-fi, Mystery), with a different list from that category each day.
- A Cult 80s list and channel: Big Trouble in Little China, RoboCop, UHF, Alligator, Turkish Star Wars and seven more.
- Analytics count minutes actually watched (per film, per channel, per day), clicks on the front page, film page and header (anything with `data-track`), and a daily funnel: visits that clicked something, pressed play, and watched 1, 10 and 30+ minutes. Each tab carries a random visit id that is only counted into the funnel, never stored; still no cookies and no IP addresses. The stats page shows all three.
- The TV page shows what audiences (TMDB) and critics (Rotten Tomatoes, or Metacritic) made of the film on now. `scripts/backfill-critics.mjs` adds the critics' score (`rt`) to the index for every film on a channel; 144 of 296 have one.
- The front page leads with a list, face out like a video store's new-releases wall, and a button that goes deeper (all 80s action, all westerns). A different list each day from `src/programme/shelves.json`, the same for everyone.
- Television is the second thing on the front page: the selected channel playing silently at the scheduled minute, over the guide grid, six channels at a time with Channel up and Channel down. The picture only streams while it is on screen, pauses in a hidden tab, and stays a poster for reduced motion or Data Saver.
- Watch together on the TV page copies a link that puts whoever opens it on the same frame.
- Channel 0 explains itself when it is empty.
- The TV page shows your channel's lineup as cards, each with a remove button, so a film can come off without finding its page again.
- Browsing a genre now lists every film the index knows in that genre, not only the uploads whose uploader typed a genre tag on Archive.org. Comedy in the 1980s goes from 37 films to 128, horror from 51 to 163. Archive.org's own tagged uploads follow after the index runs out. Most Popular sorts by how many people rated a film.
- A "Wrong poster?" link on films whose poster came from the index, opening a pre-filled issue with the identifier, the upload title and our guess ([#221](https://github.com/amponce/archive-movie-browser/pull/221), closes #120).

### Changed

- The line under the TV set is tidier: the film's title in full, one line of facts (on until, how far in you joined, TMDB and critics), and real buttons for Start from the beginning (then Back to live), Pop out and About this film.
- Picking a channel in the guide (front page and TV page) plays it right under the row, with sound, from the scheduled minute. It shows the poster and "Tuning in" while Archive.org starts the stream, and Tap to play if a phone blocks autoplay. Pick the row again to close it. Only one film plays with sound at a time.
- Watch together moves under the channel list on the TV page.
- Tonight's orphan moves down the front page, between the category rows.
- The guide shows 90 minutes on a phone, times on the half hour, and tints what is on air up to now. It works out programmes from the lineups, so a page left open does not go stale. Guide rows show keyboard focus.
- More like this on a film page only shows films matched to TMDB. It used to fill up with unidentified uploads when the index ran short.
- The index records how long each upload actually runs (`d`), measured from its Archive.org file list, alongside the film's length from TMDB. Browse, the length filter and the front page use it, so a one-minute upload of The Shining no longer shows as a 144-minute feature, and of two uploads of a film the full-length one is shown. Uploads not yet measured are taken at their name (trailer, teaser, turner_video, tv spot).
- The player moves to the next file when the first one plays sound over a black picture. Archive.org labels every uploaded mp4 "MPEG4" whatever its codec, and some originals are DivX-era video browsers cannot decode; the 512kb derivative always plays.
- Reuse successful Archive.org search responses for five minutes, keeping at most 100 in memory, so returning to a filter avoids another network request ([#217](https://github.com/amponce/archive-movie-browser/pull/217)).
- The front page's shelf, Under 90 minutes row and hero fallback now need a film's TMDB rating to come from at least 50 people. The index stores the vote count as `k`.

### Fixed

- An Archive.org link pasted into the search box on the front page, TV or Lists pages opened a search for the link's text. It opens what the link points at now, and old `/browse?q=<archive link>` addresses redirect.
- Film descriptions from Archive.org show as text instead of raw HTML (closes #246).
- Adding films to your channel from more than one tab (or from a page brought back with Back) no longer drops the films added elsewhere. Every add and remove now starts from what is saved at that moment, and open pages keep up with each other.
- MCP genre browsing across All Films now uses the same poster index as the site, including decade, upload length, ordering and duplicate-upload filtering. Recent uploads and collection-specific browsing still use Archive.org.
- Opening a film from a card no longer flashes the browse page and its filters for a moment before the film appears.
- TV events were being dropped by the analytics endpoint, which only accepted a fixed list of event names. Tune-ins, Watch together and channel edits are counted now, with tune-ins and ten minutes watched per channel.
- `/mcp/`, `/stats/`, `/tv/`, `/browse/` and `/lists/` with a trailing slash reach the app instead of a hosting 404 ([#215](https://github.com/amponce/archive-movie-browser/pull/215), closes #166).
- Show a recovery message after a render error instead of a blank page; a broken film page closes without taking down the catalogue ([#219](https://github.com/amponce/archive-movie-browser/pull/219), closes #32).
- Search text is capped at 200 characters and twelve words, so a pasted paragraph no longer breaks the Archive.org query ([#216](https://github.com/amponce/archive-movie-browser/pull/216), closes #165).

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

### Also in 2.0.0, added

- Curated lists at `/lists`: hand-picked films with a line on each, as pages anyone can link to. A list is one JSON file in `src/lists/`, so adding one is a pull request with no code (see the README there). Three to start: noir under ninety minutes, Buster Keaton in an evening, drive-in double features.
- The poster index grew from 643 to 6,698 uploads and now follows what the app shows (the top of every genre pill and decade, not just each collection): the popular views went from 51% to 100% indexed, so almost every card gets its poster with no TMDB request. The film page says when the index identified an upload as a different film.
- Our own cookieless usage counts (`/api/event`, stored as counts in Redis) with a private stats page for the maintainer. See Privacy in the README.

### Also in 2.0.0, changed

- When the same film is uploaded more than once, the list keeps the sharper or larger copy instead of whichever upload was downloaded most ([#118](https://github.com/amponce/archive-movie-browser/issues/118)).
- The collection dropdown and the genre pills always both apply. A genre used to switch to every film collection while the dropdown kept showing the old one. **All Films** is a new choice and the default; a search shows "Everything (searching)".
- The MCP page and the stats page are part of the React app now (`/mcp`, `/stats`); the old `.html` addresses redirect.
- Genre lives in the pills only: the collection dropdown no longer lists Film Noir or Sci-Fi & Horror (links to them open All Films with the matching pill), and the Film Noir pill includes the curated Film Noir collection.
- The site opens on Horror in All Films, where the most striking posters are. All Genres is one click away and is kept in the URL (`?genre=all`); picking another library shows all of it.
- A list that has reached its end says so, and offers to look in All Films with the same filters.
- The rules for filters in the URL moved into `src/services/urlFilters.js`, with tests ([#145](https://github.com/amponce/archive-movie-browser/pull/145)).

### Also in 2.0.0, fixed

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
