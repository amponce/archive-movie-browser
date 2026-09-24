import React, { useEffect, useState } from 'react';
import { collectionUploads, bestOfCollection, loadRankedCollections, showable } from '../../services/collectionBest';
import { loadPosterIndex } from '../../services/posterIndex';
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
async function bestFor(id) {
  const [rankings, index] = await Promise.all([loadRankedCollections(), loadPosterIndex()]);
  const judged = rankings[id];
  if (judged) {
    const films = judged.films.filter(fid => showable(fid, index[fid])).map(fid => ({ id: fid, entry: index[fid] }));
    return { films, identified: judged.identified, total: judged.total, title: judged.title, byJev: true };
  }
  const [{ identifiers, total }, title] = await Promise.all([collectionUploads(id), titleOf(id)]);
  return { ...bestOfCollection(index, identifiers), total, title, byJev: false };
}

export default function CollectionBest({ id }) {
  const [best, setBest] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setBest(null);
    bestFor(id)
      .then(found => { if (!cancelled) setBest(found); })
      .catch(() => { /* Archive.org did not answer: the collection's page still works without it */ });
    return () => { cancelled = true; };
  }, [id]);

  if (!best || best.films.length < 6) return null;
  const index = Object.fromEntries(best.films.map(f => [f.id, f.entry]));
  const list = {
    slug: `collection-${id}`,
    title: `The best of ${best.title}`,
    blurb: `${best.identified.toLocaleString('en-US')} of the ${best.total.toLocaleString('en-US')} uploads in this collection are films we have identified. ${best.byJev ? 'These are its highlights, then the best known of the rest.' : 'These are the best known of them.'}`,
    films: best.films.map(f => ({ id: f.id })),
  };
  return (
    <Shelf list={list} index={index} lead={false}
        note={`${Math.min(best.films.length, 20)} films from the collection, read from Archive.org just now.`}
      more={{ label: 'Watch them as a channel', href: shareUrl(best.films.map(f => f.id)) }}
      second={{ label: 'On Archive.org', href: `https://archive.org/details/${id}` }} />
  );
}
