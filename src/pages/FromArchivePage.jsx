import React, { useEffect, useState } from 'react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import { parseArchiveUrl, pathFor } from '../services/archiveUrl';

// What each kind of Archive.org address opens as here, with a real one to try
const KINDS = [
  { what: "Someone's page", path: '/details/@jason_scott', opens: 'The films they have favourited and the lists they keep, with posters. Watch their favourites as a channel.' },
  { what: 'A list someone keeps', path: '/details/@jason_scott/lists/1', opens: 'The films in the list. Watch the whole list as a channel.' },
  { what: 'A film', path: '/details/night_of_the_living_dead_dvd', opens: 'The film, with its poster, story and critics’ score.' },
  { what: 'One file inside an upload', path: '/details/hexziasmovies/Annabelle+Comes+Home.mp4', opens: 'That file, playing, when an upload holds several films.' },
  { what: 'A collection', path: '/details/classic_tv_1990s', opens: 'Every film in it, to browse and filter.' },
  { what: 'A search', path: '/details/movies?query=subject:horror AND year:[1980 TO 1989]', opens: 'The same search, run here, trailers left out.' },
];

// /from-archive: any archive.org address opens here when orphanedfilms.com takes archive.org's place
export default function FromArchivePage() {
  useEffect(() => { document.title = 'Opening Archive.org links | Orphaned Films'; }, []);
  const [text, setText] = useState('');
  const link = parseArchiveUrl(text);
  // A /details/ address is the same address with this site's name; anything else (a search.php
  // or RSS link) goes where pasting it in the search box would
  const DETAILS = /^(https?:\/\/)?(www\.)?archive\.org(?=\/details\/)/i;
  const here = link && window.location.origin + (DETAILS.test(text.trim()) ? text.trim().replace(DETAILS, '') : pathFor(link));

  return (
    <div className="min-h-screen">
      <SiteHeader current="/from-archive" />
      <main className="gutter py-12 flex flex-col gap-10 max-w-[72ch]">
        <div className="flex flex-col gap-4">
          <h1 className="display text-4xl sm:text-5xl">Open any Archive.org link here</h1>
          <p className="text-lg text-muted leading-relaxed">
            Take an address from archive.org and put orphanedfilms.com in place of archive.org. The same page opens here,
            with posters, the film's details and a player, and you can turn it into a TV channel. Nothing is copied or kept
            here: it's read from Archive.org each time.
          </p>
          <p className="text-xl text-bone font-mono break-all">
            archive.org/details/@jason_scott<br />
            orphanedfilms.com/details/@jason_scott
          </p>
        </div>

        <section aria-labelledby="try-link" className="flex flex-col gap-3">
          <h2 id="try-link" className="display text-2xl">Try one</h2>
          <label htmlFor="archive-link" className="text-muted">Paste an archive.org address</label>
          <input
            id="archive-link" type="url" value={text} onChange={e => setText(e.target.value)}
            placeholder="https://archive.org/details/@someone"
            className="w-full rounded-full bg-transparent border border-rule px-5 min-h-[48px] text-bone placeholder:text-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          />
          <p className="text-muted min-h-[1.5em] break-all" aria-live="polite">
            {text.trim() && (link ? <>Opens as <a href={here} className="underline text-bone hover:text-signal">{here}</a></> : "That isn't an archive.org address.")}
          </p>
        </section>

        <section aria-labelledby="what-opens" className="flex flex-col gap-5">
          <h2 id="what-opens" className="display text-2xl">What opens</h2>
          <dl className="flex flex-col gap-5">
            {KINDS.map(kind => (
              <div key={kind.what} className="flex flex-col gap-1">
                <dt className="text-bone font-semibold">{kind.what}</dt>
                <dd className="text-muted leading-relaxed">
                  {kind.opens}{' '}
                  <a href={kind.path} className="underline text-bone hover:text-signal break-all">orphanedfilms.com{kind.path}</a>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-muted leading-relaxed">
            Anything else from archive.org can go in the search box at the top of any page: paste the link and it opens what it points at.
            A film added to your channel from someone else's list or favourites stays in this browser, private to you.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
