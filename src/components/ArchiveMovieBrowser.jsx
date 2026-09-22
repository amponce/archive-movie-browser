import React, { useState, useEffect, useRef } from 'react';
import archiveService from '../services/archive';
import tmdbService from '../services/tmdb';
import { track } from '../services/analytics';
import useFilms from '../hooks/useFilms';
import useBrowseFilters from '../hooks/useBrowseFilters';
import useViewMode from '../hooks/useViewMode';
import SearchBox from './SearchBox';
import SettingsModal from './SettingsModal';
import MovieDetailPage from './MovieDetailPage';
import McpBanner from './McpBanner';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import FilterBar from './browse/FilterBar';
import GenrePills from './browse/GenrePills';
import FilmGrid from './browse/FilmGrid';

// The browse page. The filters live in useBrowseFilters (and the URL), the films in useFilms,
// the pieces of the page in components/browse. What is left here is opening and closing a
// film, which touches history and every way a film can be reached.
export default function ArchiveMovieBrowser() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [linkError, setLinkError] = useState(null);
  const [viewMode, changeViewMode] = useViewMode();
  const selectedRef = useRef(null); // what popstate and hashchange see without re-subscribing
  selectedRef.current = selectedMovie;

  // An identifier from anywhere (a pasted link, Forward, the hash) opens the film
  const openFilmLink = (identifier) => {
    setLinkError(null);
    archiveService.getMovieByIdentifier(identifier)
      .then(setSelectedMovie)
      .catch(() => setLinkError(`Couldn't open that Archive.org link. Check the address: nothing was found at "${identifier}".`));
  };
  // A pick from the type-ahead can be a full film or just an identifier from the index
  const openPick = (film) => (film.fromIndex ? openFilmLink(film.identifier) : setSelectedMovie(film));

  const browse = useBrowseFilters({
    onOpenFilmLink: openFilmLink,
    onReopenFilm: (identifier) => { if (!selectedRef.current) openFilmLink(identifier); },
  });
  const { filters } = browse;
  const films = useFilms({ search: filters.activeSearch, sort: filters.sort, genre: filters.genre, collection: filters.category, decade: filters.decade, contentType: filters.contentType, minRuntime: filters.minRuntime });

  // A #identifier in the URL opens that film: on load (a shared link), and whenever the hash
  // changes while the page is open (Spin the reel, a link from the header's search).
  useEffect(() => {
    let cancelled = false;
    const openFromHash = () => {
      const identifier = window.location.hash.slice(1);
      if (!identifier) return;
      let decoded;
      try { decoded = decodeURIComponent(identifier); } catch { decoded = identifier; }
      if (selectedRef.current?.identifier === decoded) return;
      archiveService.getMovieByIdentifier(decoded)
        .then((movie) => { if (!cancelled) setSelectedMovie(movie); })
        .catch((err) => { if (!cancelled) console.error('Failed to open movie from URL hash:', err); });
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => { cancelled = true; window.removeEventListener('hashchange', openFromHash); };
  }, []);

  // Every way of opening a film (card, link, search, related) ends up here
  useEffect(() => {
    if (selectedMovie) track('Film opened', { film: selectedMovie.identifier, title: selectedMovie.title });
  }, [selectedMovie?.identifier]);

  // The film page closes through history.back(), and that popstate also restores the filters
  // from the URL. So a search made from the film page waits until the close has happened;
  // applied any earlier, the restore would undo it.
  const afterClose = useRef(null);
  const closeFilmThen = (action) => { afterClose.current = action; window.history.back(); };

  return (
    <div className="min-h-screen">
      <McpBanner />
      <SiteHeader
        current="/browse"
        search={(
          <SearchBox
            value={filters.searchQuery}
            onChange={browse.typeSearch}
            onSearch={browse.search}
            onOpenFilm={openPick}
            onPickGenre={browse.pickGenre}
            onPickCollection={browse.changeCategory}
            movies={films.movies}
            loading={films.loading}
          />
        )}
      >
        <FilterBar browse={browse} viewMode={viewMode} onViewMode={changeViewMode} onOpenSettings={() => setSettingsOpen(true)} />
      </SiteHeader>

      <main className="gutter py-6">
        <GenrePills genre={filters.genre} onChange={browse.changeGenre} />
        <FilmGrid films={films} browse={browse} viewMode={viewMode} onOpen={setSelectedMovie} linkError={linkError} />
      </main>
      <SiteFooter />

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} currentApiKey={tmdbService.apiKey} />

      {selectedMovie && (
        <MovieDetailPage
          movie={selectedMovie}
          onClose={() => {
            setSelectedMovie(null);
            // A search made from the film page runs once the page has closed (see afterClose)
            const next = afterClose.current;
            afterClose.current = null;
            next?.();
          }}
          allMovies={films.movies}
          onPlayRelated={setSelectedMovie}
          onSearch={(text) => closeFilmThen(() => browse.search(text))}
          onPickGenre={(genre) => closeFilmThen(() => browse.pickGenre(genre))}
          onPickCollection={(id) => closeFilmThen(() => browse.changeCategory(id))}
        />
      )}
    </div>
  );
}
