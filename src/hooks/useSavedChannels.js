import { useEffect, useMemo, useState } from 'react';
import { onAirAt, programmesBetween } from '../services/schedule';
import { served } from './useMyChannel';

// The TV's view of a person's own server channels: list is [{ id, name }] (services/yourChannels).
// Each one's films come from /api/channel/<id>, its lineup from /api/tv?channel=<id> (keyed by
// those films, so an edit is not answered from the edge cache). A channel that fails to load,
// or has nothing that airs, is left out. pending: some are still loading.
export default function useSavedChannels(list, hours = 6) {
  const [loaded, setLoaded] = useState({}); // id -> lineup (empty when it failed)
  const key = list.map(c => c.id).join(',');

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    key.split(',').forEach(async (id) => {
      let lineup = [];
      try {
        const res = await fetch(`/api/channel/${encodeURIComponent(id)}`);
        if (res.ok) {
          const ids = (await res.json()).films.map(f => f.film);
          if (ids.length) lineup = await served(id, ids);
        }
      } catch { /* left out this visit */ }
      if (!cancelled) setLoaded(had => ({ ...had, [id]: lineup }));
    });
    return () => { cancelled = true; };
  }, [key]);

  return useMemo(() => {
    const now = Date.now();
    const channels = list.filter(c => loaded[c.id]?.length).map(c => {
      const lineup = loaded[c.id].map(f => ({ id: f.id, title: f.title, year: f.year, poster: f.poster || null, seconds: f.seconds, url: f.url }));
      const slot = onAirAt(lineup, now);
      return {
        id: `c-${c.id}`,
        name: c.name,
        lineup,
        now: slot && { film: slot.film, offset: slot.offset, startsAt: slot.startedAt, endsAt: slot.endsAt },
        programmes: programmesBetween(lineup, now, now + hours * 3600_000).map(p => ({ id: p.film.id, title: p.film.title, year: p.film.year, poster: p.film.poster, startsAt: p.startsAt, endsAt: p.endsAt })),
      };
    });
    return { channels, pending: list.some(c => !(c.id in loaded)) };
  }, [list, loaded, hours]);
}
