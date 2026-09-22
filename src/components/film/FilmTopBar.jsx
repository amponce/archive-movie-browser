import React, { useState } from 'react';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import SearchBox from '../SearchBox';
import archiveService from '../../services/archive';

// The bar across the top of the film page: back, search again without going back, the
// original page on Archive.org. `backButtonRef` is where focus lands when the page opens.
export default function FilmTopBar({ movie, backButtonRef, allMovies, onSearch, onOpen, onPickGenre, onPickCollection }) {
  const [searchText, setSearchText] = useState('');
  return (
    <div className="sticky top-0 z-10 bg-ink/90 backdrop-blur border-b border-line">
      <div className="gutter py-3 flex items-center justify-between gap-3">
        <button ref={backButtonRef} onClick={() => window.history.back()} aria-label="Back to Browse" className="nav-link flex items-center gap-1 flex-shrink-0">
          <ChevronLeft className="w-5 h-5" />
          <span className="hidden md:inline">Back</span>
        </button>

        {/* A film picked here opens here; anything else returns to the list */}
        {onSearch && (
          <div className="flex-1 flex max-w-xl">
            <SearchBox
              value={searchText}
              onChange={setSearchText}
              onSearch={(text) => text.trim() && onSearch(text)}
              onOpenFilm={(film) => { setSearchText(''); if (film.fromIndex) archiveService.getMovieByIdentifier(film.identifier).then(onOpen).catch(() => {}); else onOpen(film); }}
              onPickGenre={onPickGenre}
              onPickCollection={onPickCollection}
              movies={allMovies}
            />
          </div>
        )}

        <a href={movie.archiveUrl} target="_blank" rel="noopener noreferrer" aria-label="View on Archive.org" className="nav-link flex items-center gap-2 flex-shrink-0">
          <span className="hidden md:inline">On archive.org</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
