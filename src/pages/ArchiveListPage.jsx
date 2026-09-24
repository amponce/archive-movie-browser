import React, { useEffect, useState } from 'react';
import { indexedMatch } from '../services/posterIndex';
import { isTakenDown, isForbidden } from '../services/policy';
import { identifierQueries } from '../services/archive';
import tmdbService from '../services/tmdb';
import { watchUrl } from '../services/reel';
import { readMyChannel, toggleSaved, hasFilm, shareUrl } from '../services/myChannel';
import { track } from '../services/analytics';
import { CardGrid } from '../ui/Section';
import FilmCard from '../ui/FilmCard';
import Button from '../ui/Button';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';

const SEARCH = 'https://archive.org/advancedsearch.php';

// Archive.org's search, for title, year and kind
export async function searchDocs(q, rows) {
  const params = new URLSearchParams({ q, rows: String(rows), output: 'json' });
  for (const field of ['identifier', 'title', 'year', 'mediatype', 'subject', 'description']) params.append('fl[]', field);
  return (await (await fetch(`${SEARCH}?${params}`)).json()).response?.docs || [];
}

// Each search result as a card, with the poster and title from the index where it has them.
// A taken-down upload (src/services/policy.js) is left out.
export const withPosters = (docs) => Promise.all(docs.filter(doc => !isTakenDown(doc.identifier) && !isForbidden(doc)).map(async (doc) => {
  const match = await indexedMatch(doc.identifier);
  return {
    id: doc.identifier,
    film: doc.mediatype === 'movies',
    title: match?.title || String(doc.title || doc.identifier),
    year: Number(match?.releaseDate) || Number(String(doc.year || '').slice(0, 4)) || null,
    poster: match?.posterPath ? tmdbService.getPosterUrl(match.posterPath, 'medium') : null,
  };
}));

// The items of a list in the list's order
async function describe(identifiers) {
  const items = [];
  for (const { ids, q } of identifierQueries(identifiers)) {
    const byId = new Map((await searchDocs(q, ids.length)).map(doc => [doc.identifier, doc]));
    items.push(...ids.map(id => byId.get(id)).filter(Boolean));
  }
  return withPosters(items);
}

// Film cards that can each go on your own channel, which stays in this browser
export function FilmGrid({ films, track: from }) {
  const [mine, setMine] = useState(readMyChannel);
  const toggle = (filmId) => { setMine(toggleSaved(filmId)); track('TV', { action: hasFilm(mine, filmId) ? 'remove from my channel' : 'add to my channel', film: filmId }); };
  return (
    <CardGrid>
      {films.map(film => (
        <div key={film.id} className="flex flex-col gap-2">
          <FilmCard film={film} href={watchUrl(film.id)} track={from} />
          <button type="button" onClick={() => toggle(film.id)} aria-pressed={hasFilm(mine, film.id)} className="nav-link text-left hover:text-signal">
            {hasFilm(mine, film.id) ? 'On my channel' : 'Add to my channel'}
          </button>
        </div>
      ))}
    </CardGrid>
  );
}

// /details/@someone/lists/1: a list someone keeps on Archive.org, read from Archive.org each visit
// (nothing is kept here). The films in it can go on your own channel, which stays in this browser.
export default function ArchiveListPage({ user, id }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const archiveUrl = `https://archive.org/details/@${user}/lists/${id}`;

  useEffect(() => {
    fetch(`/api/archive-list?user=${encodeURIComponent(user)}&list=${id}`)
      .then(async r => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || `Error ${r.status}`))))
      .then(async data => { setList({ ...data, items: null }); document.title = `${data.name} | Orphaned Films`; setList({ ...data, items: await describe(data.identifiers) }); })
      .catch(e => setError(e.message));
  }, [user, id]);

  const films = list?.items?.filter(item => item.film) || [];
  const others = (list?.items?.length || 0) - films.length;

  return (
    <div className="min-h-screen">
      <SiteHeader current="/lists" />
      <main className="gutter py-10 flex flex-col gap-8">
        {error && (
          <div className="flex flex-col gap-3 max-w-[64ch]">
            <h1 className="display text-4xl">That list didn't open</h1>
            <p className="text-muted">{error} <a href={archiveUrl} className="underline text-bone">Open it on Archive.org</a>.</p>
          </div>
        )}
        {!list && !error && <p className="text-muted" role="status">Opening the list from Archive.org…</p>}
        {list && (
          <>
            <div className="flex flex-col gap-4 max-w-[72ch]">
              <p className="text-muted">A list by <a href={`https://archive.org/details/@${user}`} className="underline text-bone">@{user}</a> on Archive.org</p>
              <h1 className="font-display font-black uppercase leading-[0.9] text-[44px] sm:text-[72px]">{list.name}</h1>
              {list.description && <p className="text-lg text-muted leading-relaxed">{list.description}</p>}
              {list.items && (
                <p className="text-bone">
                  {films.length} film{films.length === 1 ? '' : 's'}{others === 1 ? ', and 1 other item that isn\'t a film' : others > 1 ? `, and ${others} other items that aren't films` : ''}. Read from Archive.org just now; nothing is kept here.
                </p>
              )}
              {films.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  <Button href={shareUrl(films.map(f => f.id))} size="lg" data-track="archive-list-as-channel">Watch this list as a channel</Button>
                  <Button href={archiveUrl} variant="ghost" size="lg">On Archive.org</Button>
                </div>
              )}
            </div>
            {!list.items && <p className="text-muted" role="status">Looking up {list.identifiers.length} items…</p>}
            {list.items && films.length === 0 && <p className="text-muted">None of the items in this list are films. <a href={archiveUrl} className="underline text-bone">See them on Archive.org</a>.</p>}
            {films.length > 0 && (
              <section aria-labelledby="list-films" className="flex flex-col gap-5">
                <div>
                  <h2 id="list-films" className="display text-2xl">The films</h2>
                  <p className="text-muted mt-1">Add any of them to your own channel. It stays in this browser, private to you.</p>
                </div>
                <FilmGrid films={films} track="archive-list-film" />
              </section>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
