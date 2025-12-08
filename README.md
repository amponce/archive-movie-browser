# Archive Movie Browser

A modern, responsive web application for browsing and watching public domain movies from the Internet Archive. Features high-quality movie posters from TMDB, genre filtering, and an embedded video player.

<img width="1841" height="1294" alt="image" src="https://github.com/user-attachments/assets/cfe7ca9c-537c-4db3-9bb2-aebbffa3b083" />


## Features

- **Browse Public Domain Films** - Access thousands of free, legal movies from Archive.org's collection
- **High-Quality Posters** - Automatically matches movies with TMDB for professional movie posters
- **Genre Filtering** - Filter by Horror, Sci-Fi, Comedy, Drama, and more
- **Smart Search** - Search for specific titles across the entire Archive.org movie collection
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

- Node.js 18+
- npm or yarn
- TMDB API key (free at [themoviedb.org](https://www.themoviedb.org/settings/api))

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
- Type a movie title in the search box and press Enter or click Search
- Search results show all matching movies regardless of TMDB poster availability
- Clear the search to return to browsing mode

### Watching Movies
- Click any movie card to open the detail page
- Click "Watch Now" to start the embedded Archive.org player
- Browse related movies at the bottom of the detail page

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_TMDB_API_KEY` | Your TMDB API key for movie posters | Yes |

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

## API Credits

- **Internet Archive** - [archive.org](https://archive.org) - Public domain movie collection and streaming
- **TMDB** - [themoviedb.org](https://www.themoviedb.org) - Movie database API for posters and metadata

> This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Acknowledgments

- Internet Archive for making public domain films accessible
- TMDB for their comprehensive movie database API
- The React and Vite communities
