import React, { useState } from 'react';
import { Calendar, Globe, DollarSign, TrendingUp, Users, Play } from 'lucide-react';
import tmdbService from '../../services/tmdb';
import archiveService from '../../services/archive';
import Button from '../../ui/Button';
import { track } from '../../services/analytics';
import { readMyChannel, writeMyChannel, toggleFilm, hasFilm } from '../../services/myChannel';

// The words about the film: what it is, what the upload was called, the facts, the overview,
// who made it and who is in it (click a name to search for them), then Watch now and the
// personal channel.
export default function FilmDetails({ movie, details, titleId, playing, onPlay, onSearch }) {
  const { tmdbDetails, identified, director, cast, genres } = details;

  const [myChannel, setMyChannel] = useState(readMyChannel);
  const onMyChannel = hasFilm(myChannel, movie.identifier);
  const toggleMyChannel = () => {
    const next = toggleFilm(myChannel, movie.identifier);
    writeMyChannel(next); setMyChannel(next);
    track('TV', { action: onMyChannel ? 'remove from my channel' : 'add to my channel', film: movie.identifier });
  };

  return (
    <div className="flex-1 min-w-0">
      <p className="eyebrow mb-3">Orphan file</p>
      <h1 id={titleId} className="display text-[44px] sm:text-6xl lg:text-7xl mb-4">{tmdbDetails?.title || movie.title}</h1>

      {/* The upload was called something else; the poster index worked out which film it is */}
      {identified && (
        <p className="text-sm text-muted mb-3">
          Uploaded to Archive.org as <span className="line-through decoration-dim">{identified.uploadTitle}</span>.
          Identified by the <a href="/mcp" className="text-signal hover:underline">poster index</a>
          {identified.confidence ? ` (${Math.round(identified.confidence * 100)}% sure)` : ''}.
        </p>
      )}
      {tmdbDetails?.tagline && <p className="text-lg text-muted italic mb-5">"{tmdbDetails.tagline}"</p>}

      <div className="flex flex-wrap items-center gap-5 font-mono text-xs text-muted mb-6">
        {(tmdbDetails?.release_date || movie.year) && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{tmdbDetails?.release_date?.split('-')[0] || movie.year}</span>}
        {tmdbDetails?.original_language && <span className="flex items-center gap-1"><Globe className="w-4 h-4" />{tmdbDetails.original_language.toUpperCase()}</span>}
        {tmdbDetails?.budget > 0 && <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" />{tmdbDetails.budget >= 1e6 ? `$${(tmdbDetails.budget / 1e6).toFixed(1)}M` : `$${tmdbDetails.budget.toLocaleString()}`} budget</span>}
        {movie.downloads > 0 && <span className="flex items-center gap-1"><TrendingUp className="w-4 h-4" />{Number(movie.downloads).toLocaleString()} downloads</span>}
      </div>

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

      <div className="mb-6">
        <h3 className="label mb-2">Overview</h3>
        <p className="text-muted text-[17px] leading-relaxed max-w-[64ch]">{tmdbDetails?.overview || movie.description || 'No description available.'}</p>
      </div>

      {director && <div className="mb-6"><h3 className="label mb-2">Director</h3><p className="text-bone">{director.name}</p></div>}

      {cast.length > 0 && (
        <div className="mb-6">
          <h3 className="label mb-3">Cast</h3>
          <div className="flex flex-wrap gap-3">
            {cast.map((actor) => (
              <button key={actor.id} type="button" onClick={() => onSearch?.(actor.name)} disabled={!onSearch} title={onSearch ? `Search for ${actor.name}` : undefined}
                className="flex items-center gap-2 panel rounded-full pr-3 text-left hover:border-bone disabled:hover:border-line focus-visible:outline-none focus-visible:border-signal">
                {actor.profile_path
                  ? <img src={tmdbService.getProfileUrl(actor.profile_path)} alt={actor.name} className="w-8 h-8 rounded-full object-cover" />
                  : <div className="w-8 h-8 rounded-full bg-line flex items-center justify-center"><Users className="w-4 h-4 text-dim" /></div>}
                <div className="text-sm"><p className="text-bone">{actor.name}</p><p className="text-xs text-dim">{actor.character}</p></div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!playing && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Button size="lg" onClick={onPlay} className="flex-1"><Play className="w-5 h-5 fill-current" /> Watch now</Button>
          <Button size="lg" variant="ghost" onClick={toggleMyChannel} aria-pressed={onMyChannel} title="Your own TV channel, kept in this browser">
            {onMyChannel ? 'On my channel' : 'Add to my channel'}
          </Button>
        </div>
      )}
    </div>
  );
}
