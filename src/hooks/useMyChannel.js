import { useEffect, useMemo, useState } from 'react';
import archiveService from '../services/archive';
import tmdbService from '../services/tmdb';
import { indexedMatch } from '../services/posterIndex';
import { pickPlayableFile, videoUrl } from '../services/playback';
import { onAirAt, programmesBetween, airable } from '../services/schedule';
import { readMyChannel, channelFromUrl, MY_CHANNEL_ID } from '../services/myChannel';

// The personal channel in the same shape as the channels from /api/tv, so the TV page treats it
// like any other. Film lengths come from each item's own Archive.org record (one request per
// film, remembered in this browser), posters from the index.
const LENGTHS_KEY = 'tv-film-lengths';
const readLengths = () => { try { return JSON.parse(localStorage.getItem(LENGTHS_KEY) || '{}') || {}; } catch { return {}; } };

async function measure(id, known) {
  if (known[id]) return known[id];
  const data = await archiveService.getMetadata(id);
  const file = pickPlayableFile(data.files);
  const entry = { seconds: Math.round(Number(file?.length) || 0), file: file?.name || null, title: data.metadata?.title || id, year: Number(String(data.metadata?.year || '').slice(0, 4)) || null };
  const match = await indexedMatch(id);
  if (match) { entry.title = match.title; entry.year = Number(match.releaseDate) || entry.year; entry.poster = tmdbService.getPosterUrl(match.posterPath, 'medium'); }
  return entry;
}

export default function useMyChannel(hours = 6) {
  const fromLink = useMemo(() => channelFromUrl(window.location.search), []);
  const ids = useMemo(() => fromLink || readMyChannel(), [fromLink]);
  const [lengths, setLengths] = useState(readLengths);

  useEffect(() => {
    let cancelled = false;
    const missing = ids.filter(id => !lengths[id]);
    if (!missing.length) return undefined;
    (async () => {
      const next = { ...lengths };
      for (const id of missing) {
        try { next[id] = await measure(id, next); } catch { next[id] = { seconds: 0 }; }
        if (cancelled) return;
      }
      try { localStorage.setItem(LENGTHS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      setLengths(next);
    })();
    return () => { cancelled = true; };
  }, [ids]);

  return useMemo(() => {
    if (!ids.length) return null;
    const lineup = airable(ids.map(id => lengths[id] && lengths[id].file ? { id, title: lengths[id].title, year: lengths[id].year, poster: lengths[id].poster || null, seconds: lengths[id].seconds, url: videoUrl(id, lengths[id].file) } : null).filter(Boolean));
    const now = Date.now();
    const slot = onAirAt(lineup, now);
    return {
      id: MY_CHANNEL_ID,
      number: 0,
      name: fromLink ? 'A shared channel' : 'My channel',
      mine: !fromLink,
      ids,
      pending: ids.filter(id => !lengths[id]).length,
      lineup,
      now: slot && { film: slot.film, offset: slot.offset, startsAt: slot.startedAt, endsAt: slot.endsAt },
      programmes: programmesBetween(lineup, now, now + hours * 3600_000).map(p => ({ id: p.film.id, title: p.film.title, year: p.film.year, poster: p.film.poster, startsAt: p.startsAt, endsAt: p.endsAt })),
    };
  }, [ids, lengths, fromLink, hours]);
}
