import { useCallback, useEffect, useState } from 'react';
import { readProfile, ensureProfile, api } from '../services/profile';

let cache = null;
const listeners = new Set();
const publish = data => { cache = data; listeners.forEach(fn => fn(data)); };

export async function refreshProfile() {
  const p = readProfile();
  if (!p) { publish(null); return; }
  const res = await api(`/api/profile/${p.id}`);
  publish(res.ok ? await res.json() : null);
}

export default function useProfile() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    listeners.add(setData);
    setData(cache); // a publish may have landed between render and subscribe
    if (cache === null && readProfile()) refreshProfile();
    return () => listeners.delete(setData);
  }, []);
  const toggleFavourite = useCallback(async (film) => {
    const profile = await ensureProfile();
    const on = !(cache?.favourites || []).includes(film);
    publish({ ...(cache || { channels: [], saved: [] }), favourites: on ? [film, ...(cache?.favourites || [])] : (cache?.favourites || []).filter(f => f !== film) });
    const res = await api(`/api/profile/${profile.id}/favourites/${encodeURIComponent(film)}`, { method: on ? 'PUT' : 'DELETE', profile });
    if (!res.ok) await refreshProfile();
  }, []);
  return { profile: readProfile(), data, refresh: refreshProfile, toggleFavourite };
}
