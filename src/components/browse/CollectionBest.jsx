import React, { useEffect, useState } from 'react';
import { collectionUploads, bestOfCollection, loadRankedCollections, showable } from '../../services/collectionBest';
import { loadPosterIndex, cartoonOutOfPlace } from '../../services/posterIndex';
import { shareUrl } from '../../services/myChannel';
import { collectionName, VIDEO_CATEGORIES } from '../../services/archive';
import Shelf from '../home/Shelf';

const SEARCH = 'https://archive.org/advancedsearch.php';

// Its title from Archive.org when it is not one of ours ("vhsvault" -> "The VHS Vault")
async function titleOf(id) {
  if (VIDEO_CATEGORIES.some(c => c.id === id)) return collectionName(id);
  const params = new URLSearchParams({ q: `identifier:"${id}"`, 'fl[]': 'title', rows: '1', output: 'json' });
  const doc = (await (await fetch(`${SEARCH}?${params}`)).json()).response?.docs?.[0];
  return String(doc?.title || id);
}

// At the top of a collection's page: the best films in it that the poster index has identified,
// as a shelf. Jev's ranking when the collection is in public/collections.json (every film checked
// again against the site's rules), otherwise ranked live, best known first, from Archive.org.
// Nothing shows until there are at least six.
// A genre on All Films ('genre:Horror', 'genre:all') ranks the index; a collection ranks its
// uploads. With no decade picked, Jev's ranking from public/collections.json when there is one;
// with a decade, the films from that decade only, best known first, so the shelf follows the
// filters like the grid below it does.
async function bestFor(id, decade) {
  const [rankings, index] = await Promise.all([loadRankedCollections(), loadPosterIndex()]);
  const judged = rankings[id];
  if (judged && !decade) {
    const films = judged.films.filter(fid => showable(fid, index[fid])).map(fid => ({ id: fid, entry: index[fid] }));
    return { films, identified: judged.identified, total: judged.total, title: judged.title, byJev: true };
  }
  // Films Jev was sure do not belong stay out whatever the filters
  const strays = new Set((judged?.strays || []).map(([fid]) => fid));
  const inDecade = fid => !strays.has(fid) && (!decade || (index[fid]?.y >= Number(decade) && index[fid]?.y < Number(decade) + 10));
  if (id.startsWith('genre:')) {
    const genre = id.slice('genre:'.length);
    const ids = Object.keys(index).filter(fid => inDecade(fid) && (genre === 'all' || (index[fid].g?.includes(genre) && !cartoonOutOfPlace(index[fid].g, genre))));
    return { ...bestOfCollection(index, ids), total: ids.length, title: genre === 'all' ? 'everything we have found' : genre, byJev: false };
  }
  const [{ identifiers, total }, title] = await Promise.all([collectionUploads(id), judged?.title || titleOf(id)]);
  return { ...bestOfCollection(index, identifiers.filter(inDecade)), total, title, byJev: false };
}

export default function CollectionBest({ id, decade = null }) {
  const [best, setBest] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setBest(null);
    bestFor(id, decade)
      .then(found => { if (!cancelled) setBest(found); })
      .catch(() => { /* Archive.org did not answer: the collection's page still works without it */ });
    return () => { cancelled = true; };
  }, [id, decade]);

  if (!best || best.films.length < 6) return null;
  const index = Object.fromEntries(best.films.map(f => [f.id, f.entry]));
  const genre = id.startsWith('genre:');
  const list = {
    slug: `collection-${id.replace(':', '-')}`,
    title: decade
      ? (genre ? (id === 'genre:all' ? `The best of the ${decade}s` : `The best of ${decade}s ${best.title.toLowerCase()}`) : `The best of ${best.title} from the ${decade}s`)
      : `The best of ${best.title}`,
    blurb: genre
      ? `${best.identified.toLocaleString('en-US')} ${id === 'genre:all' ? '' : `${best.title.toLowerCase()} `}films${decade ? ` from the ${decade}s` : ''} on the Archive that we have identified. ${best.byJev ? 'These are the highlights, then the best known of the rest.' : 'These are the best known of them.'}`
      : `${best.identified.toLocaleString('en-US')} of the ${best.total.toLocaleString('en-US')} uploads in this collection are films we have identified. ${best.byJev ? 'These are its highlights, then the best known of the rest.' : 'These are the best known of them.'}`,
    films: best.films.map(f => ({ id: f.id })),
  };
  return (
    <Shelf list={list} index={index} lead={false}
        note={best.byJev ? `${Math.min(best.films.length, 20)} films, ranked this week.` : `${Math.min(best.films.length, 20)} films, ranked just now.`}
      more={{ label: 'Watch them as a channel', href: shareUrl(best.films.map(f => f.id)) }}
      second={genre ? false : { label: 'On Archive.org', href: `https://archive.org/details/${id}` }} />
  );
}
