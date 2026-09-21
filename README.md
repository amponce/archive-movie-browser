# Archive Movie Browser

A modern, responsive web application for browsing and watching films hosted on the Internet Archive. Features high-quality movie posters from TMDB, genre filtering, and an embedded video player.

<img width="1841" height="1294" alt="image" src="https://github.com/user-attachments/assets/cfe7ca9c-537c-4db3-9bb2-aebbffa3b083" />


**Live demo:** https://archive-movie-browser.vercel.app

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Famponce%2Farchive-movie-browser)

It runs without any configuration. For movie posters, add `VITE_TMDB_API_KEY` in your Vercel project's environment variables and redeploy.

## Features

- **Browse the Internet Archive's films** - A front end to Archive.org's video collections: it shows what Archive.org hosts, with better search, filtering and posters
- **Real posters, no key needed** - A poster index maps messy Archive.org uploads to the real film, so most films show their TMDB poster with no API key; the rest get a designed cover
- **Genre Filtering** - Filter by Horror, Sci-Fi, Comedy, Drama, and more
- **Smart Search** - Suggestions as you type, matching titles, subjects, and creators across every collection at once
- **Shareable views** - Filters, searches and films all live in the URL, so any view can be bookmarked or sent to a friend
- **Embedded Player** - Watch movies directly in the browser without leaving the site
- **Movie Details** - View cast, director, ratings, runtime, and plot synopsis
- **Related Movies** - Discover similar films based on genre
- **Responsive Design** - Works great on desktop and mobile devices, keyboard and screen-reader accessible
- **MCP server** - Let an AI assistant search and recommend the films ([mcp/](mcp/README.md))
- **Persistent Cache** - TMDB data is cached locally for faster subsequent loads

## Tech Stack

- **React 19** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **Archive.org API** - Movie data and streaming
- **TMDB API** - Movie posters and metadata

## Getting Started

### Prerequisites

- Node.js 22+
- npm or yarn
- Optional: TMDB API key for movie posters (free at [themoviedb.org](https://www.themoviedb.org/settings/api))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/amponce/archive-movie-browser.git
cd archive-movie-browser
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Add your TMDB API key to `.env`:
```
VITE_TMDB_API_KEY=your_tmdb_api_key_here
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

![Archive Movie Browser](https://archive.org/services/img/feature_films)


### Browsing Movies
- Use the genre pills to filter by genre across all the film collections
- Toggle between "Full Movies" and "Shorts" for different content types
- Adjust minimum runtime with the duration filter
- Sort by popularity, rating, newest, or alphabetically

### Searching
- Type a title, subject, or creator in the search box and press Enter or click Search
- A search looks across every collection, not just the selected one, and matches all the words you type
- Search results show all matching movies regardless of TMDB poster availability or missing runtime data
- Empty the search box or pick a category to return to browsing mode

### Watching Movies
- Click any movie card to open the detail page
- Click "Watch Now" to start the embedded Archive.org player
- Browse related movies at the bottom of the detail page

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_TMDB_API_KEY` | Your TMDB API key for movie posters | No (recommended) |

### Without TMDB API Key

The app works without a TMDB API key:
- Films in the [poster index](#poster-index) still show their real poster; the rest get a generated cover
- Films outside the index are not matched live, so fewer of them have posters
- No cast, director or TMDB ratings on the detail page

## Project Structure

```
archive-movie-browser/
├── src/
│   ├── components/
│   │   ├── ArchiveMovieBrowser.jsx  # Main app: filters, URL state, grid
│   │   ├── SearchBox.jsx            # Search input with suggestions
│   │   ├── MovieCard.jsx            # Movie card (grid/list)
│   │   ├── MovieDetailPage.jsx      # Film dialog with the player
│   │   ├── TitleCover.jsx           # Generated poster for films without one
│   │   └── SettingsModal.jsx        # Settings dialog
│   └── services/                    # No React or DOM: reusable, each with a *.test.js
│       ├── archive.js               # Archive.org search, filtering, de-duplication
│       ├── tmdb.js                  # TMDB lookups with a bounded cache
│       ├── movieMatching.js         # Upload title -> film title candidates and matching
│       ├── posterIndex.js           # Reads public/poster-index.json
│       ├── suggest.js               # Search suggestions
│       └── coverDesign.js           # Palette and shape for generated posters
├── public/poster-index.json         # Which upload is which film, decided offline
├── scripts/build-poster-index.mjs   # Builds the index (npm run index)
├── mcp/                             # MCP server on top of src/services
├── vercel.json                      # Security headers, including the CSP
└── vite.config.js
```

## Poster Index

Archive.org titles are messy (`H 2 House On Haunted Hill ( 1959) Classic Vincent Price Horror Full Movie`), so matching them to TMDB in the browser misses a lot. `public/poster-index.json` holds decisions made offline instead: for the most-downloaded uploads in each film collection, which TMDB film it is, or that it is none. The app checks the index first, so indexed films get real posters **with no TMDB key and no TMDB requests**, and anything not indexed falls back to live matching.

- Build or extend it with `npm run index` (options are in the header of `scripts/build-poster-index.mjs`). It needs a TMDB key and an OpenRouter key in `.env.local`; see `.env.example`. A decision is permanent per Archive.org identifier, so reruns only pay for new uploads. 750 uploads cost about 3 cents.
- The decisions come from a small decision model (`typesafe/jev-1.13`), which picks among the TMDB candidates we fetch and reports a confidence. Below 0.7 the app shows the generated cover instead: a wrong poster is worse than none. On a hand-labelled set of 80 hard search results this got 67 right with 0 wrong posters, against 43 right and 5 wrong for the in-browser heuristics.
- A scheduled workflow refreshes it weekly and pushes the result to a branch for review.
- **Found a wrong poster?** Edit that identifier's entry in `public/poster-index.json` and open a PR. Setting it to `{ "n": 1, "c": 1, "m": 1 }` means "show the generated cover"; `"m": 1` marks an entry as corrected by hand, and the build script never overwrites those.

## MCP Server

`mcp/` is a [Model Context Protocol](https://modelcontextprotocol.io) server built on the same Archive.org code as the site, so an AI assistant can search the films, browse collections and hand back links that play. Four tools, no API keys. Setup for Claude Code, Claude Desktop and Cursor is in [mcp/README.md](mcp/README.md).

## Make It Yours

Fork it and turn it into your own themed archive: only westerns, only Prelinger educational films, only silent comedies.

- **Collections** - edit `VIDEO_CATEGORIES` in `src/services/archive.js`. Each `id` is an Archive.org collection identifier, the last part of a URL like `archive.org/details/Film_Noir`.
- **Default collection** - change the initial `category` state in `src/components/ArchiveMovieBrowser.jsx`.
- **Genres** - edit `STANDARD_GENRES` and `GENRE_ALIASES` in `src/services/archive.js`.

All Archive.org access goes through `src/services/archive.js`, which has no React or DOM dependencies, so it can be reused outside this app.

## Privacy

The live site counts usage with its own small endpoint (`api/event.js`): no cookies, no third party, no visitor identifiers, nothing sold or shared. It stores **counts only** in a Redis database: events per day, and monthly leaderboards of films opened and played, searches, filters and referring sites. IP addresses are never stored; distinct visitors are estimated with a HyperLogLog fed by a hash that changes every day, so days cannot be linked. Search text is lowercased, cut to 60 characters, and anything shaped like an email address is removed before it leaves the browser. Bots are not counted, and everything expires after 400 days. The rulebook is `api/_stats.js` and it is tested.

A fork collects nothing unless its owner connects an Upstash Redis database (`vercel integration add upstash/upstash-kv`) and sets a `STATS_TOKEN` for the private `/stats` page.

## API Credits

- **Internet Archive** - [archive.org](https://archive.org) - Public domain movie collection and streaming
- **TMDB** - [themoviedb.org](https://www.themoviedb.org) - Movie database API for posters and metadata

> This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

[MIT](LICENSE) - feel free to use this project for personal or commercial purposes.

## Contributing

Contributions are welcome, from first-time contributors and from people who just love old films. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, what to work on, and what review looks like. See the [CHANGELOG](CHANGELOG.md) for release history. Run `npm test` and `npm run build` before opening a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Contributors

Thanks to everyone who has had a pull request merged:

- [@dyk1454683243-sudo](https://github.com/dyk1454683243-sudo) - first outside contributor: the Shorts mode runtime control ([#21](https://github.com/amponce/archive-movie-browser/pull/21))
- [@ruthikx](https://github.com/ruthikx) - Escape, Back button and scroll lock for the detail page, plus shareable `#identifier` links to any film ([#20](https://github.com/amponce/archive-movie-browser/pull/20))
- [@mehul-vi](https://github.com/mehul-vi) - removed 174 lines of dead code ([#18](https://github.com/amponce/archive-movie-browser/pull/18))
- [@fatihcvs](https://github.com/fatihcvs) - a long run of fixes across matching, accessibility and performance, including shared film links ([#48](https://github.com/amponce/archive-movie-browser/pull/48)), keyboard access to films ([#52](https://github.com/amponce/archive-movie-browser/pull/52)), screen-reader labels for the filters ([#53](https://github.com/amponce/archive-movie-browser/pull/53)), one TMDB service with a lean cache ([#51](https://github.com/amponce/archive-movie-browser/pull/51)), accurate poster matching ([#57](https://github.com/amponce/archive-movie-browser/pull/57)), evenly spaced TMDB requests ([#56](https://github.com/amponce/archive-movie-browser/pull/56)), a precise content blocklist ([#50](https://github.com/amponce/archive-movie-browser/pull/50)), a header and footer that follow what you're browsing ([#91](https://github.com/amponce/archive-movie-browser/pull/91)), a proper modal dialog for the detail page ([#94](https://github.com/amponce/archive-movie-browser/pull/94)), and [more](https://github.com/amponce/archive-movie-browser/pulls?q=is%3Apr+is%3Amerged+author%3Afatihcvs)
- [@dw-dash-codes](https://github.com/dw-dash-codes) - the `TitleCover` component, so no view shows a raw Archive.org frame grab ([#54](https://github.com/amponce/archive-movie-browser/pull/54))
- [@nightcityblade](https://github.com/nightcityblade) - detail page posters stay at full brightness, with a labelled, focusable play button ([#71](https://github.com/amponce/archive-movie-browser/pull/71))
- [@karthikyannabthina](https://github.com/karthikyannabthina) - filters live in the URL, so any view can be shared and the Back button works ([#100](https://github.com/amponce/archive-movie-browser/pull/100))
- [@Rokesh2008](https://github.com/Rokesh2008) - grid or list view is remembered between visits ([#110](https://github.com/amponce/archive-movie-browser/pull/110))
- [@kante-Ramanaidu](https://github.com/kante-Ramanaidu) - on phones, the selected genre scrolls into view, so shared genre links look right ([#125](https://github.com/amponce/archive-movie-browser/pull/125))
- [@MehulNegi](https://github.com/MehulNegi) - the project's changelog, from the first release on ([#141](https://github.com/amponce/archive-movie-browser/pull/141))

Want to be next? Issues labelled [good first issue](https://github.com/amponce/archive-movie-browser/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) are scoped, with file and line references.

## Acknowledgments

- Internet Archive for making public domain films accessible
- TMDB for their comprehensive movie database API
- The React and Vite communities
