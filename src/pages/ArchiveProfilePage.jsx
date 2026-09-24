import React, { useEffect, useState } from 'react';
import { searchDocs, withPosters, FilmGrid } from './ArchiveListPage';
import { shareUrl } from '../services/myChannel';
import Button from '../ui/Button';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';

// /details/@someone: the films that person has favourited on Archive.org and the lists they keep,
// read from Archive.org each visit (nothing is kept here).
// ponytail: the first 500 favourites; page through them if someone's favourites run past that.
export default function ArchiveProfilePage({ user }) {
  const [favourites, setFavourites] = useState(null);
  const [lists, setLists] = useState(null);
  const [error, setError] = useState(null);
  const archiveUrl = `https://archive.org/details/@${user}`;

  useEffect(() => {
    document.title = `@${user} | Orphaned Films`;
    fetch(`/api/archive-list?user=${encodeURIComponent(user)}`)
      .then(async r => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || `Error ${r.status}`))))
      .then(data => setLists(data.lists))
      .catch(e => setError(e.message));
    searchDocs(`collection:fav-${user} AND mediatype:movies`, 500)
      .then(withPosters)
      .then(setFavourites)
      .catch(() => setFavourites([]));
  }, [user]);

  const loading = !error && (favourites === null || lists === null);

  return (
    <div className="min-h-screen">
      <SiteHeader current="/lists" />
      <main className="gutter py-10 flex flex-col gap-8">
        <div className="flex flex-col gap-4 max-w-[72ch]">
          <p className="text-muted">Someone on <a href={archiveUrl} className="underline text-bone">Archive.org</a></p>
          <h1 className="font-display font-black uppercase leading-[0.9] text-[44px] sm:text-[72px] break-words">@{user}</h1>
          {error
            ? <p className="text-muted">{error} <a href={archiveUrl} className="underline text-bone">Look on Archive.org</a>.</p>
            : <p className="text-lg text-muted leading-relaxed">The films they've favourited and the lists they keep, read from Archive.org just now. Nothing is kept here.</p>}
        </div>
        {loading && <p className="text-muted" role="status">Opening @{user}'s page from Archive.org…</p>}

        {!error && lists?.length > 0 && (
          <section aria-labelledby="profile-lists" className="flex flex-col gap-4">
            <h2 id="profile-lists" className="display text-2xl">Their lists</h2>
            <ul className="flex flex-col gap-2">
              {lists.map(list => (
                <li key={list.id}>
                  <a href={`/details/@${user}/lists/${list.id}`} className="text-bone underline hover:text-signal">{list.name}</a>
                  <span className="text-muted"> ({list.count} item{list.count === 1 ? '' : 's'})</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!error && favourites?.length > 0 && (
          <section aria-labelledby="profile-favourites" className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <h2 id="profile-favourites" className="display text-2xl">Their favourite films ({favourites.length})</h2>
              <p className="text-muted">Add any of them to your own channel. It stays in this browser, private to you.</p>
              <div><Button href={shareUrl(favourites.map(f => f.id))} size="lg" data-track="archive-profile-as-channel">Watch their favourites as a channel</Button></div>
            </div>
            <FilmGrid films={favourites} track="archive-profile-film" />
          </section>
        )}

        {!loading && !error && !favourites?.length && !lists?.length && (
          <p className="text-muted">@{user} hasn't favourited any films or made any public lists yet. <a href={archiveUrl} className="underline text-bone">See their page on Archive.org</a>.</p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
