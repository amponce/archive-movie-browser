import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import {
  X,
  ExternalLink,
  Clock,
  Star,
  Play,
  Calendar,
  Users,
  Film,
  Globe,
  DollarSign,
  TrendingUp,
  ChevronLeft
} from 'lucide-react';
import tmdbService from '../services/tmdb';
import archiveService from '../services/archive';
import { Sprockets, fieldFor } from '../ui/FilmCard';
import TitleCover from './TitleCover';
import Button from '../ui/Button';
import useRelated from '../hooks/useRelated';
import { pickPlayableFile } from '../services/playback';
import FilmPlayer from './FilmPlayer';
import { identifiedAs } from '../services/posterIndex';
import SearchBox from './SearchBox';

// Sub-component for related movies with TMDB poster support
function RelatedMovieCard({ movie, onClick }) {
  const [posterUrl, setPosterUrl] = useState(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [tmdbChecked, setTmdbChecked] = useState(false);

  useEffect(() => {
    // Try to get TMDB poster
    tmdbService.searchMovie(movie.title, movie.year, movie.identifier).then(data => {
      if (data?.posterPath) {
        setPosterUrl(tmdbService.getPosterUrl(data.posterPath, 'small'));
      }
    }).finally(() => setTmdbChecked(true));
  }, [movie.title, movie.year, movie.identifier]);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) handleClick(e);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group text-left cursor-pointer focus-visible:outline-none"
      role="button"
      tabIndex={0}
      aria-label={`${movie.title}, ${movie.year}`}
      onKeyDown={handleKeyDown}
    >
      <div className="film-frame group-hover:border-signal group-focus-visible:border-signal mb-2" style={{ background: fieldFor(movie.genres?.[0], movie.identifier), containerType: 'inline-size' }}>
        {posterUrl && !posterFailed ? (
          <img
            src={posterUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setPosterFailed(true)}
          />
        ) : tmdbChecked ? (
          <TitleCover movie={movie} size="small" />
        ) : null}
        <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
          <span className="w-12 h-12 rounded-full bg-signal flex items-center justify-center"><Play className="w-5 h-5 text-ink fill-ink ml-0.5" /></span>
        </div>
        <Sprockets />
      </div>
      <p className="text-sm font-medium text-bone line-clamp-2 leading-snug group-hover:text-signal">
        {movie.title}
      </p>
      {movie.year && (
        <p className="font-mono text-[11px] text-dim">{movie.year}</p>
      )}
    </div>
  );
}

export default function MovieDetailPage({ movie, onClose, allMovies = [], onPlayRelated, onSearch, onPickGenre, onPickCollection }) {
  const [searchText, setSearchText] = useState('');
  const [tmdbData, setTmdbData] = useState(null);
  const [tmdbDetails, setTmdbDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = React.useRef(null);
  const onCloseRef = useRef(onClose);
  const hasRenderedIdentifierRef = useRef(false);
  const dialogRef = useRef(null);
  const backButtonRef = useRef(null);
  const titleId = useId();
  const identified = identifiedAs(movie, tmdbData);

  // A native modal keeps background controls inert, including when focus
  // enters the embedded player. Keep one focus session across related films.
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    backButtonRef.current.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Selecting a related film can remove the focused card from the dialog.
  useEffect(() => {
    if (!dialogRef.current.contains(document.activeElement)) {
      backButtonRef.current.focus({ preventScroll: true });
    }
  }, [movie.identifier]);

  // Keep the page fixed while the full-screen overlay is displayed, and give
  // this overlay session one history entry that the browser can return from.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!window.history.state?.movieDetail) {
      // A shared URL is already a detail URL. Make its underlying history
      // entry the browse page so closing the overlay also clears the hash.
      if (window.location.hash) {
        window.history.replaceState(
          window.history.state,
          '',
          window.location.pathname + window.location.search
        );
      }
      window.history.pushState(
        { movieDetail: true, identifier: movie.identifier },
        '',
        `#${encodeURIComponent(movie.identifier)}`
      );
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Related movies reuse this overlay. Replace its one history entry instead
  // of adding an entry for every related movie viewed.
  useEffect(() => {
    if (!hasRenderedIdentifierRef.current) {
      hasRenderedIdentifierRef.current = true;
      return;
    }
    window.history.replaceState(
      { movieDetail: true, identifier: movie.identifier },
      '',
      `#${encodeURIComponent(movie.identifier)}`
    );
  }, [movie.identifier]);

  onCloseRef.current = onClose;

  // Closing always goes through history so the browser Back button, Escape,
  // and the in-page button have identical behavior.
  useEffect(() => {
    const handlePopState = () => onCloseRef.current();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      const controls = [...dialog.querySelectorAll(
        'button, a[href], input, select, textarea, iframe, video[controls], [tabindex]'
      )].filter((element) => element.tabIndex >= 0
        && !element.matches(':disabled') && element.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      // Native modality makes the background inert; explicitly wrap the
      // endpoints as well so Tab does not leave for the browser toolbar.
      if (event.shiftKey && (document.activeElement === first
        || document.activeElement === dialog)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll to player when it opens
  useEffect(() => {
    if (isPlaying && playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isPlaying]);

  // Fetch TMDB data
  useEffect(() => {
    if (!movie) return;

    let cancelled = false;
    setLoading(true);
    setIsPlaying(false);
    // Clear the previous movie's data so it can't show under this one
    setTmdbData(null);
    setTmdbDetails(null);

    // Search for movie on TMDB
    tmdbService.searchMovie(movie.title, movie.year, movie.identifier).then(async (data) => {
      if (cancelled) return;
      setTmdbData(data);

      // If we found a match, fetch detailed info
      if (data?.id) {
        const details = await tmdbService.getMovieDetails(data.id);
        if (cancelled) return;
        setTmdbDetails(details);
      }
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [movie]);

  const { films: relatedMovies, genre: relatedGenre } = useRelated(movie, allMovies, (tmdbDetails?.genres || []).map(g => g.name));

  // How long the upload itself runs, from its file: the honest number. TMDB's runtime is the
  // film's, and an upload can be a trailer or a clip of it.
  const [uploadMinutes, setUploadMinutes] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setUploadMinutes(null);
    if (!movie) return undefined;
    if (movie.runtimeMinutes > 0) { setUploadMinutes(movie.runtimeMinutes); return undefined; }
    archiveService.getMetadata(movie.identifier)
      .then(data => { const file = pickPlayableFile(data.files); if (!cancelled && file?.length) setUploadMinutes(Number(file.length) / 60); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [movie?.identifier]);
  const filmMinutes = tmdbDetails?.runtime || null;
  const isExcerpt = uploadMinutes && filmMinutes && uploadMinutes < filmMinutes * 0.5;

  if (!movie) return null;

  const posterUrl = tmdbData?.posterPath
    ? tmdbService.getPosterUrl(tmdbData.posterPath, 'large')
    : null;
  const backdropUrl = tmdbDetails?.backdrop_path
    ? tmdbService.getBackdropUrl(tmdbDetails.backdrop_path, 'w1280')
    : null;

  const director = tmdbDetails?.credits?.crew?.find(c => c.job === 'Director');
  const cast = tmdbDetails?.credits?.cast?.slice(0, 6) || [];
  const genres = tmdbDetails?.genres || movie.genres?.map(g => ({ name: g })) || [];

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        window.history.back();
      }}
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-none max-w-none border-0 p-0 bg-ink text-bone overflow-y-auto"
    >
      {/* Backdrop image */}
      {backdropUrl && (
        <div
          className="absolute inset-0 h-96 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/80 to-ink" />
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-ink/90 backdrop-blur border-b border-line">
        <div className="gutter py-3 flex items-center justify-between gap-3">
          <button
            ref={backButtonRef}
            onClick={() => window.history.back()}
            aria-label="Back to Browse"
            className="nav-link flex items-center gap-1 flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden md:inline">Back</span>
          </button>

          {/* Search again without going back: a film opens here, anything else returns to the list */}
          {onSearch && (
            <div className="flex-1 flex max-w-xl">
              <SearchBox
                value={searchText}
                onChange={setSearchText}
                onSearch={(text) => text.trim() && onSearch(text)}
                onOpenFilm={(film) => { setSearchText(''); if (film.fromIndex) archiveService.getMovieByIdentifier(film.identifier).then(onPlayRelated).catch(() => {}); else onPlayRelated(film); }}
                onPickGenre={onPickGenre}
                onPickCollection={onPickCollection}
                movies={allMovies}
              />
            </div>
          )}

          <a
            href={movie.archiveUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on Archive.org"
            className="nav-link flex items-center gap-2 flex-shrink-0"
          >
            <span className="hidden md:inline">On archive.org</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="relative gutter max-w-7xl mx-auto py-8 lg:py-10">
        {/* The player takes the top of the page while a film plays; the details stay below it */}
        {isPlaying && (
          <div className="mb-8" ref={playerRef}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="eyebrow">Now playing</h3>
              <button onClick={() => setIsPlaying(false)} className="nav-link">Close player</button>
            </div>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
              <FilmPlayer movie={movie} />
            </div>
            <p className="mt-2 font-mono text-[11px] text-dim">
              Keyboard: ← → skip 10 seconds (hold Shift for a minute), Space pauses, F is full screen, M mutes, Esc closes.
            </p>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Poster */}
          <div className={`flex-shrink-0 mx-auto lg:mx-0 ${isPlaying ? 'hidden lg:block lg:w-[200px]' : 'w-full max-w-sm lg:w-[360px]'}`}>
            <div className="film-frame shadow-2xl" style={{ background: fieldFor(movie.genres?.[0], movie.identifier), containerType: 'inline-size' }}>
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={movie.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : !loading ? (
                <TitleCover movie={movie} />
              ) : null}
              <Sprockets />

              {/* Play button overlay */}
              {!isPlaying && (
                <button
                  onClick={() => setIsPlaying(true)}
                  aria-label={`Play ${movie.title}`}
                  className="absolute inset-0 flex items-center justify-center bg-transparent hover:bg-ink/40 focus-visible:bg-ink/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-signal transition-colors group"
                >
                  <div className="w-[88px] h-[88px] rounded-full bg-signal flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Play className="w-9 h-9 text-ink fill-ink ml-1" />
                  </div>
                </button>
              )}
            </div>

            {/* Quick stats */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {tmdbDetails?.vote_average > 0 && (
                <div className="panel p-3">
                  <p className="label">TMDB rating</p>
                  <p className="font-display font-extrabold text-2xl mt-1 tabular-nums flex items-center gap-1.5"><Star className="w-4 h-4 fill-signal text-signal" />{tmdbDetails.vote_average.toFixed(1)}</p>
                </div>
              )}
              {(uploadMinutes || filmMinutes) && (
                <div className={`panel p-3 ${isExcerpt ? 'border-signal' : ''}`}>
                  <p className="label">{isExcerpt ? 'This upload' : 'Runtime'}</p>
                  <p className="font-display font-extrabold text-2xl mt-1 tabular-nums flex items-center gap-1.5"><Clock className="w-4 h-4 text-dim" />{Math.round(uploadMinutes || filmMinutes)} min</p>
                  {isExcerpt && <p className="text-xs text-muted mt-1">A trailer or a clip. The film runs {filmMinutes} min.</p>}
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <p className="eyebrow mb-3">Orphan file</p>
            <h1 id={titleId} className="display text-[44px] sm:text-6xl lg:text-7xl mb-4">
              {tmdbDetails?.title || movie.title}
            </h1>

            {/* The upload was called something else; the poster index worked out which film it is */}
            {identified && (
              <p className="text-sm text-muted mb-3">
                Uploaded to Archive.org as <span className="line-through decoration-dim">{identified.uploadTitle}</span>.
                Identified by the <a href="/mcp" className="text-signal hover:underline">poster index</a>
                {identified.confidence ? ` (${Math.round(identified.confidence * 100)}% sure)` : ''}.
              </p>
            )}

            {/* Tagline */}
            {tmdbDetails?.tagline && (
              <p className="text-lg text-muted italic mb-5">"{tmdbDetails.tagline}"</p>
            )}

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-5 font-mono text-xs text-muted mb-6">
              {(tmdbDetails?.release_date || movie.year) && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {tmdbDetails?.release_date?.split('-')[0] || movie.year}
                </span>
              )}
              {tmdbDetails?.original_language && (
                <span className="flex items-center gap-1">
                  <Globe className="w-4 h-4" />
                  {tmdbDetails.original_language.toUpperCase()}
                </span>
              )}
              {tmdbDetails?.budget > 0 && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {tmdbDetails.budget >= 1e6 ? `$${(tmdbDetails.budget / 1e6).toFixed(1)}M` : `$${tmdbDetails.budget.toLocaleString()}`} budget
                </span>
              )}
              {movie.downloads > 0 && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {Number(movie.downloads).toLocaleString()} downloads
                </span>
              )}
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {genres.map((genre, i) => {
                  // TMDB says "Science Fiction", our pills say "Sci-Fi": link only when it maps
                  const name = genre.name || genre;
                  const ours = archiveService.normalizeGenre(name);
                  return ours
                    ? <a key={i} href={`/browse?genre=${encodeURIComponent(ours)}`} className="pill inline-flex items-center">{name}</a>
                    : <span key={i} className="pill inline-flex items-center cursor-default">{name}</span>;
                })}
              </div>
            )}

            {/* Overview */}
            <div className="mb-6">
              <h3 className="label mb-2">Overview</h3>
              <p className="text-muted text-[17px] leading-relaxed max-w-[64ch]">
                {tmdbDetails?.overview || movie.description || 'No description available.'}
              </p>
            </div>

            {/* Director */}
            {director && (
              <div className="mb-6">
                <h3 className="label mb-2">Director</h3>
                <p className="text-bone">{director.name}</p>
              </div>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <div className="mb-6">
                <h3 className="label mb-3">Cast</h3>
                <div className="flex flex-wrap gap-3">
                  {cast.map((actor) => (
                    <button
                      key={actor.id}
                      type="button"
                      onClick={() => onSearch?.(actor.name)}
                      disabled={!onSearch}
                      title={onSearch ? `Search for ${actor.name}` : undefined}
                      className="flex items-center gap-2 panel rounded-full pr-3 text-left hover:border-bone disabled:hover:border-line focus-visible:outline-none focus-visible:border-signal"
                    >
                      {actor.profile_path ? (
                        <img
                          src={tmdbService.getProfileUrl(actor.profile_path)}
                          alt={actor.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-line flex items-center justify-center">
                          <Users className="w-4 h-4 text-dim" />
                        </div>
                      )}
                      <div className="text-sm">
                        <p className="text-bone">{actor.name}</p>
                        <p className="text-xs text-dim">{actor.character}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Play button */}
            {!isPlaying && (
              <Button size="lg" onClick={() => setIsPlaying(true)} className="w-full mb-6">
                <Play className="w-5 h-5 fill-current" />
                Watch now
              </Button>
            )}
          </div>
        </div>

        {/* Related from our collection */}
        {relatedMovies.length > 0 && (
          <div className="mt-12">
            <div className="flex items-end justify-between gap-6 mb-6">
              <div>
                <p className="eyebrow">Same shelf</p>
                <h3 className="display text-3xl mt-1.5">More like this</h3>
              </div>
              {relatedGenre && (
                <a href={`/browse?genre=${encodeURIComponent(relatedGenre)}`} className="nav-link shrink-0 flex items-center gap-2 hover:text-signal">All {relatedGenre} <span aria-hidden="true">→</span></a>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {relatedMovies.slice(0, 12).map((related) => (
                <RelatedMovieCard
                  key={related.identifier}
                  movie={related}
                  onClick={() => onPlayRelated?.(related)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
