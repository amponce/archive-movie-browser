# Archive Movie Browser

A modern, responsive web application for browsing and watching public domain movies from the Internet Archive. Features high-quality movie posters from TMDB, genre filtering, and an embedded video player.

<img width="1841" height="1294" alt="image" src="https://github.com/user-attachments/assets/cfe7ca9c-537c-4db3-9bb2-aebbffa3b083" />


**Live demo:** https://archive-movie-browser.vercel.app

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Famponce%2Farchive-movie-browser)

It runs without any configuration. For movie posters, add `VITE_TMDB_API_KEY` in your Vercel project's environment variables and redeploy.

## Features

- **Browse Public Domain Films** - Access thousands of free, legal movies from Archive.org's collection
- **High-Quality Posters** - Automatically matches movies with TMDB for professional movie posters
- **Genre Filtering** - Filter by Horror, Sci-Fi, Comedy, Drama, and more
- **Smart Search** - Search titles, subjects, and creators across every collection in the app at once
- **Embedded Player** - Watch movies directly in the browser without leaving the site
- **Movie Details** - View cast, director, ratings, runtime, and plot synopsis
- **Related Movies** - Discover similar films based on genre
- **Responsive Design** - Works great on desktop and mobile devices
- **Persistent Cache** - TMDB data is cached locally for faster subsequent loads

## Tech Stack

- **React 18** - Modern React with hooks
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
- Use the genre pills to filter by category (default: Horror)
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

The app works without a TMDB API key, but:
- Movie posters will use Archive.org thumbnails (lower quality)
- No TMDB ratings or additional metadata
- No poster-based filtering

## Project Structure

```
archive-movie-browser/
├── src/
│   ├── components/
│   │   ├── ArchiveMovieBrowser.jsx  # Main app component
│   │   ├── MovieCard.jsx            # Movie card (grid/list)
│   │   ├── MovieDetailPage.jsx      # Full movie detail view
│   │   ├── VideoPlayerModal.jsx     # Video player modal
│   │   └── SettingsModal.jsx        # Settings dialog
│   ├── services/
│   │   ├── archive.js               # Archive.org API service
│   │   └── tmdb.js                  # TMDB API service with caching
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

## Make It Yours

Fork it and turn it into your own themed archive: only westerns, only Prelinger educational films, only silent comedies.

- **Collections** - edit `VIDEO_CATEGORIES` in `src/services/archive.js`. Each `id` is an Archive.org collection identifier, the last part of a URL like `archive.org/details/Film_Noir`.
- **Default collection** - change the initial `category` state in `src/components/ArchiveMovieBrowser.jsx`.
- **Genres** - edit `STANDARD_GENRES` and `GENRE_ALIASES` in `src/services/archive.js`.

All Archive.org access goes through `src/services/archive.js`, which has no React or DOM dependencies, so it can be reused outside this app.

## API Credits

- **Internet Archive** - [archive.org](https://archive.org) - Public domain movie collection and streaming
- **TMDB** - [themoviedb.org](https://www.themoviedb.org) - Movie database API for posters and metadata

> This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

[MIT](LICENSE) - feel free to use this project for personal or commercial purposes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. Run `npm test` and `npm run build` before opening one.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Contributors

Thanks to everyone who has had a pull request merged:

- [@dyk1454683243-sudo](https://github.com/dyk1454683243-sudo) - first outside contributor: the Shorts mode runtime control ([#21](https://github.com/amponce/archive-movie-browser/pull/21))
- [@ruthikx](https://github.com/ruthikx) - Escape, Back button and scroll lock for the detail page, plus shareable `#identifier` links to any film ([#20](https://github.com/amponce/archive-movie-browser/pull/20))

Want to be next? Issues labelled [good first issue](https://github.com/amponce/archive-movie-browser/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) are scoped, with file and line references.

## Acknowledgments

- Internet Archive for making public domain films accessible
- TMDB for their comprehensive movie database API
- The React and Vite communities
