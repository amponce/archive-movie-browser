import { useCallback, useEffect, useState } from 'react';
import { readProfile, ensureProfile, api } from '../services/profile';

let cache = null;
const listeners = new Set();
const publish = data => { cache = data; listeners.forEach(fn => fn(data)); };

// One load per page: concurrent callers share it, and a load that already finished (even a
// failed one) is not repeated by a mount. A toggle made while a load is out is applied on top
// of the result, so the older answer cannot undo it.
let inflight = null;
let settled = false;
const toggles = [];
const applyToggles = (favourites, from) => toggles.slice(from).filter(t => !t.failed)
  .reduce((list, t) => (t.on ? [t.film, ...list.filter(f => f !== t.film)] : list.filter(f => f !== t.film)), favourites);

export function refreshProfile() {
  inflight ||= (async () => {
    const from = toggles.length;
    try {
      const p = readProfile();
      if (!p) return;
      const res = await api(`/api/profile/${p.id}`);
      if (!res.ok) return;
      const data = await res.json();
      publish({ ...data, favourites: applyToggles(data.favourites || [], from) });
    } catch { /* keep what we have; a later refresh can retry */ }
  })().finally(() => { inflight = null; settled = true; });
  return inflight;
}

// This browser's profile id, without loading the profile: updates when a profile is made here
export function useProfileId() {
  const [, changed] = useState(0);
  useEffect(() => {
    const fn = () => changed(n => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return readProfile()?.id || null;
}

export default function useProfile() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    listeners.add(setData);
    setData(cache); // a publish may have landed between render and subscribe
    if (cache === null && !inflight && !settled && readProfile()) refreshProfile();
    return () => listeners.delete(setData);
  }, []);
  const toggleFavourite = useCallback(async (film) => {
    const had = (cache?.favourites || []).includes(film);
    const on = !had;
    const entry = { film, on };
    const set = (value) => publish({ ...(cache || { channels: [], saved: [] }), favourites: value ? [film, ...(cache?.favourites || []).filter(f => f !== film)] : (cache?.favourites || []).filter(f => f !== film) });
    const fresh = !readProfile();
    try {
      const profile = await ensureProfile();
      toggles.push(entry);
      set(on);
      const res = await api(`/api/profile/${profile.id}/favourites/${encodeURIComponent(film)}`, { method: on ? 'PUT' : 'DELETE', profile });
      if (!res.ok) throw new Error(`favourite ${res.status}`);
      if (fresh) refreshProfile(); // the first save may have carried an old channel over
    } catch {
      entry.failed = true;
      set(had);
      refreshProfile();
    }
  }, []);
  return { get profile() { return readProfile(); }, data, refresh: refreshProfile, toggleFavourite };
}
