import { useEffect, useMemo, useRef, useState } from 'react';
import { onAirAt, programmesBetween } from '../services/schedule';
import { airable, toFetch } from '../services/yourChannels';
import { served } from './useMyChannel';

// The TV's view of a person's own server channels: list is [{ id, name, films }] (services/yourChannels).
// Each one's films come from /api/channel/<id>, its lineup from /api/tv?channel=<id> (keyed by
// those films, so an edit is not answered from the edge cache). Only a channel whose film count
// changed is loaded again. A channel that fails to load, or has nothing that airs, is left out
// and keeps its number. pending: some are still loading.
export default function useSavedChannels(list, hours = 6) {
  const [loaded, setLoaded] = useState({}); // id -> lineup (empty when it failed)
  const asked = useRef({}); // id -> the film count its lineup was asked for at
  const key = list.map(c => `${c.id}:${c.films}`).join(',');

  useEffect(() => {
    const wanted = key ? key.split(',').map((entry) => { const [id, films] = entry.split(':'); return { id, films: Number(films) }; }) : [];
    toFetch(wanted, asked.current).forEach(async ({ id, films }) => {
      asked.current[id] = films;
      let lineup = [];
      try {
        const res = await fetch(`/api/channel/${encodeURIComponent(id)}`);
        if (res.ok) {
          const ids = (await res.json()).films.map(f => f.film);
          if (ids.length) lineup = await served(id, ids);
        }
      } catch { /* left out this visit */ }
      if (asked.current[id] === films) setLoaded(had => ({ ...had, [id]: lineup }));
    });
  }, [key]);

  return useMemo(() => {
    const now = Date.now();
    const channels = airable(list, loaded).map(c => {
      const lineup = loaded[c.id].map(f => ({ id: f.id, title: f.title, year: f.year, poster: f.poster || null, seconds: f.seconds, url: f.url }));
      const slot = onAirAt(lineup, now);
      return {
        id: `c-${c.id}`,
        number: c.number,
        name: c.name,
        lineup,
        now: slot && { film: slot.film, offset: slot.offset, startsAt: slot.startedAt, endsAt: slot.endsAt },
        programmes: programmesBetween(lineup, now, now + hours * 3600_000).map(p => ({ id: p.film.id, title: p.film.title, year: p.film.year, poster: p.film.poster, startsAt: p.startsAt, endsAt: p.endsAt })),
      };
    });
    return { channels, pending: list.some(c => !(c.id in loaded)) };
  }, [list, loaded, hours]);
}
