import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { LISTS } from '../lists/index';
import { listBySlug } from '../services/lists';
import archiveService from '../services/archive';
import { indexedMatch } from '../services/posterIndex';
import tmdbService from '../services/tmdb';
import MovieDetailPage from '../components/MovieDetailPage';
import { track } from '../services/analytics';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';

const REPO = 'https://github.com/amponce/archive-movie-browser';

// A film on a list, from the poster index alone: no request until it is opened
function ListFilm({ id, note, position, onOpen }) {
  const [film, setFilm] = useState(null);
  useEffect(() => { indexedMatch(id).then(setFilm); }, [id]);
  const poster = film?.posterPath ? tmdbService.getPosterUrl(film.posterPath, 'medium') : null;
  return (
    <li>
      <button
        onClick={() => onOpen(id)}
        className="group w-full text-left flex gap-4 sm:gap-5 p-3 rounded-lg hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
      >
        <span className="text-2xl text-gray-600 tabular-nums w-8 shrink-0 pt-1">{position}</span>
        <span className="relative w-20 sm:w-24 aspect-[2/3] shrink-0 bg-gray-800 rounded overflow-hidden">
          {poster && <img src={poster} alt="" className="w-full h-full object-cover" loading="lazy" />}
        </span>
        <span className="min-w-0 pt-1">
          <span className="block text-lg font-semibold text-white group-hover:text-yellow-400">{film?.title || id}{film?.releaseDate && <span className="text-gray-400 font-normal"> ({film.releaseDate})</span>}</span>
          {note && <span className="block text-gray-300 mt-1 leading-snug">{note}</span>}
        </span>
      </button>
    </li>
  );
}

// /lists: every list. /lists/<slug>: one list, with the film page opening in place.
export default function ListsPage({ slug }) {
  const list = slug ? listBySlug(LISTS, slug) : null;
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    document.title = list ? `${list.title} | Archive Movie Browser` : 'Lists | Archive Movie Browser';
    track('Page view', { path: location.pathname });
  }, [list]);

  const open = (id) => archiveService.getMovieByIdentifier(id).then(movie => { track('Film opened', { film: id, title: movie.title }); setSelected(movie); }).catch(() => {});

  return (
    <div className="min-h-screen text-muted">
      <SiteHeader current="/lists" />
      <div className="max-w-3xl mx-auto px-4 py-6">
        <nav className="flex items-center justify-between text-sm mb-8">
          {list ? <a href="/lists" className="nav-link flex items-center gap-1"><ChevronLeft className="w-4 h-4" />All runs</a> : <span />}
          <a href={`${REPO}/tree/main/src/lists`} className="nav-link">Add a list</a>
        </nav>

        {list ? (
          <>
            <h1 className="display-type text-5xl sm:text-6xl leading-none text-white mb-4">{list.title}</h1>
            <p className="text-lg text-gray-300 leading-relaxed mb-2">{list.blurb}</p>
            <p className="text-sm text-gray-500 mb-8">{list.films.length} films · curated by <a href={`https://github.com/${list.curator}`} className="hover:text-gray-300 underline">@{list.curator}</a></p>
            <ol className="space-y-1">
              {list.films.map((film, i) => <ListFilm key={film.id} id={film.id} note={film.note} position={i + 1} onOpen={open} />)}
            </ol>
          </>
        ) : (
          <>
            <h1 className="display-type text-5xl sm:text-6xl leading-none text-white mb-4">Lists</h1>
            <p className="text-lg text-gray-300 leading-relaxed mb-8">Films worth an evening, picked by people who have watched a lot of them. Every film plays here, free.</p>
            <ul className="space-y-4">
              {LISTS.map(entry => (
                <li key={entry.slug}>
                  <a href={`/lists/${entry.slug}`} className="block p-5 rounded-xl bg-gray-800/60 border border-gray-700 hover:border-yellow-400/60">
                    <span className="block text-2xl font-semibold text-white">{entry.title}</span>
                    <span className="block text-gray-300 mt-1 leading-snug">{entry.blurb.split('. ')[0]}.</span>
                    <span className="block text-sm text-gray-500 mt-2">{entry.films.length} films · @{entry.curator}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-gray-400 mt-10">Have a list in you? It's one JSON file and a pull request: <a href={`${REPO}/blob/main/src/lists/README.md`} className="text-yellow-400 hover:underline">how to add one</a>.</p>
          </>
        )}
      </div>

      {selected && (
        <MovieDetailPage movie={selected} onClose={() => setSelected(null)} allMovies={[]} onPlayRelated={setSelected} />
      )}
      <SiteFooter />
    </div>
  );
}
