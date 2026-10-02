import { useCallback, useEffect, useMemo, useState } from 'react';
import archiveService from '../services/archive';
import tmdbService from '../services/tmdb';
import { indexedMatch } from '../services/posterIndex';
import { pickPlayableFile, videoUrl } from '../services/playback';
import { onAirAt, programmesBetween, airable } from '../services/schedule';
import { readMyChannel, removeSaved, channelFromUrl, MY_CHANNEL_ID, MY_CHANNEL_KEY } from '../services/myChannel';
import { readLengths, rememberLength, measureEach } from '../services/filmLengths';

// The personal channel in the same shape as the channels from /api/tv, so the TV page treats it
// like any other. Film lengths come from each item's own Archive.org record (one request per
// film, six at a time, each remembered in this browser as it lands), posters from the index.
async function measure(id) {
  const data = await archiveService.getMetadata(id);
  const file = pickPlayableFile(data.files);
  const entry = { seconds: Math.round(Number(file?.length) || 0), file: file?.name || null, title: data.metadata?.title || id, year: Number(String(data.metadata?.year || '').slice(0, 4)) || null };
  const match = await indexedMatch(id);
  if (match) { entry.title = match.title; entry.year = Number(match.releaseDate) || entry.year; entry.poster = tmdbService.getPosterUrl(match.posterPath, 'medium'); }
  return entry;
}

// A community channel's lineup, built by the server from its saved films (/api/tv?channel=).
// The films are part of the address, so an edit is not answered from the edge cache.
async function served(id, ids) {
  const films = ids.join('\n');
  let hash = 0;
  for (let i = 0; i < films.length; i += 1) hash = (hash * 31 + films.charCodeAt(i)) | 0;
  const response = await fetch(`/api/tv?channel=${encodeURIComponent(id.replace(/^c-/, ''))}&v=${(hash >>> 0).toString(36)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()).channels?.[0]?.lineup || [];
}

// shared: { id, name, ids } for a channel from the server; it is read-only here
export default function useMyChannel(hours = 6, shared = null) {
  const fromLink = useMemo(() => shared?.ids || channelFromUrl(window.location.search), [shared]);
  const [own, setIds] = useState(() => fromLink || readMyChannel());
  const ids = shared ? shared.ids : own;
  const [lengths, setLengths] = useState(readLengths);
  // Films whose record could not be read on this visit: left out for now, asked again next load
  const [failed, setFailed] = useState(() => new Set());
  // A shared channel's lineup from the server, with the ids it was asked for
  const [fromServer, setFromServer] = useState(null);
  const sharedId = shared?.id;

  // Take a film off your own channel (a shared one is someone else's to edit)
  const remove = useCallback((id) => {
    if (fromLink) return;
    setIds(removeSaved(id));
  }, [fromLink]);

  // Films added in another tab show up here without a reload
  useEffect(() => {
    if (fromLink) return undefined;
    const refresh = (event) => { if (!event.key || event.key === MY_CHANNEL_KEY) setIds(readMyChannel()); };
    window.addEventListener('storage', refresh);
    window.addEventListener('pageshow', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('pageshow', refresh); };
  }, [fromLink]);

  // A shared channel asks the server again whenever its films change (an owner's edit)
  useEffect(() => {
    if (!sharedId || !ids.length) return undefined;
    let cancelled = false;
    served(sharedId, ids).catch(() => []).then(lineup => { if (!cancelled) setFromServer({ ids, lineup }); });
    return () => { cancelled = true; };
  }, [sharedId, ids]);

  // The schedule is one cycle through every film, so what is on now depends on every length:
  // the lineup changes once, when the last film is measured, never film by film
  useEffect(() => {
    if (sharedId) return undefined;
    let cancelled = false;
    const missing = ids.filter(id => !lengths[id]);
    if (!missing.length) return undefined;
    const landed = {};
    const lost = new Set();
    const once = id => measure(id).catch(() => measure(id)); // one retry for a dropped request
    measureEach(missing, once, (id, entry) => {
      if (entry) { landed[id] = entry; rememberLength(id, entry); } else lost.add(id);
    }, { cancelled: () => cancelled }).then(() => {
      if (cancelled) return;
      setLengths(known => ({ ...known, ...landed }));
      setFailed(lost);
    });
    return () => { cancelled = true; };
  }, [ids, sharedId]);

  return useMemo(() => {
    if (!ids.length) return null;
    const loaded = !shared || fromServer?.ids === ids;
    const lineup = shared ? (loaded ? fromServer.lineup.map(f => ({ id: f.id, title: f.title, year: f.year, poster: f.poster || null, seconds: f.seconds, url: f.url })) : []) : airable(ids.map(id => lengths[id] && lengths[id].file ? { id, title: lengths[id].title, year: lengths[id].year, poster: lengths[id].poster || null, seconds: lengths[id].seconds, url: videoUrl(id, lengths[id].file) } : null).filter(Boolean));
    const now = Date.now();
    const slot = onAirAt(lineup, now);
    return {
      id: shared?.id || MY_CHANNEL_ID,
      number: 0,
      name: shared?.name || (fromLink ? 'A shared channel' : 'My channel'),
      mine: !fromLink,
      ids,
      remove,
      pending: shared ? (loaded ? 0 : ids.length) : ids.filter(id => !lengths[id] && !failed.has(id)).length,
      lineup,
      now: slot && { film: slot.film, offset: slot.offset, startsAt: slot.startedAt, endsAt: slot.endsAt },
      programmes: programmesBetween(lineup, now, now + hours * 3600_000).map(p => ({ id: p.film.id, title: p.film.title, year: p.film.year, poster: p.film.poster, startsAt: p.startsAt, endsAt: p.endsAt })),
    };
  }, [ids, lengths, failed, fromServer, fromLink, shared, hours, remove]);
}
