import React, { useEffect, useState } from 'react';
import { collectionUploads, bestOfCollection } from '../../services/collectionBest';
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
// as a shelf, read from Archive.org each visit. Nothing shows until there are at least six.
export default function CollectionBest({ id }) {
  const [best, setBest] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setBest(null);
    Promise.all([collectionUploads(id), loadPosterIndex(), titleOf(id)])
      .then(([{ identifiers, total }, index, title]) => { if (!cancelled) setBest({ ...bestOfCollection(index, identifiers), total, title }); })
      .catch(() => { /* Archive.org did not answer: the collection's page still works without it */ });
    return () => { cancelled = true; };
  }, [id]);

  if (!best || best.films.length < 6) return null;
  const index = Object.fromEntries(best.films.map(f => [f.id, f.entry]));
  const list = {
    slug: `collection-${id}`,
    title: `The best of ${best.title}`,
    blurb: `${best.identified.toLocaleString('en-US')} of the ${best.total.toLocaleString('en-US')} uploads in this collection are films we have identified. These are the best known of them.`,
    films: best.films.map(f => ({ id: f.id })),
  };
  return (
    <Shelf list={list} index={index} lead={false}
        note={`${Math.min(best.films.length, 20)} films from the collection, read from Archive.org just now.`}
      more={{ label: 'Watch them as a channel', href: shareUrl(best.films.map(f => f.id)) }}
      second={{ label: 'On Archive.org', href: `https://archive.org/details/${id}` }} />
  );
}
