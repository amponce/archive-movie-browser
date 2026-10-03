import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import Button from '../ui/Button';
import { FilmGrid, withPosters } from './ArchiveListPage';
import { api, readProfile, editLink, readPrevious, switchBack } from '../services/profile';
import { refreshProfile } from '../hooks/useProfile';
import { protectProfile, listPasskeys, removePasskey, NEW_LINK } from '../services/passkey';
import { cleanHandle, toHandle } from '../services/handle';

const LABEL = { unlisted: 'Unlisted', submitted: 'In review', public: 'Public', featured: 'Featured' };
const FIELD = 'bg-transparent border-b border-line text-bone w-full py-1';
// Put together here so the address appears nowhere as one string
const REPORT_TO = ['hello', 'orphanedfilms.com'].join('@');

// /u/<id> or /u/<handle>: a profile's name, channels, saved channels and favourites. Its owner
// can edit the name, Archive.org username and handle, and copy the edit link.
export default function ProfilePage({ slug }) {
  const [p, setP] = useState(undefined);
  const [films, setFilms] = useState([]);
  const [manual, setManual] = useState(false); // the clipboard was not available
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false); // the last save did not go through
  const [reserved, setReserved] = useState(false); // the name was refused as reserved
  const [reset, setReset] = useState(0); // remounts the inputs back to the stored values
  const me = readProfile();
  const isOwner = !!p && me?.id === p.id;
  const previous = isOwner && readPrevious();
  // A sign-in just replaced the edit key: show the new link, once
  const [newLink] = useState(() => { try { return sessionStorage.getItem(NEW_LINK) === slug; } catch { return false; } });
  useEffect(() => { if (newLink) { try { sessionStorage.removeItem(NEW_LINK); } catch { /* private mode */ } } }, [newLink]);

  const loads = useRef(0);
  const id = useRef(null); // once loaded, reloads go by id: the handle may change
  const load = useCallback(() => {
    const n = ++loads.current;
    return api(`/api/profile/${id.current || slug}`)
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(data => {
        if (n !== loads.current) return;
        if (data?.moved) { window.location.replace(`/u/${data.moved}`); return; }
        if (data) id.current = data.id;
        setP(data);
      });
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  // The address bar shows the profile's handle when it has one, its id when not
  useEffect(() => {
    if (!p) return;
    const address = `/u/${p.handle || p.id}`;
    if (window.location.pathname.replace(/\/+$/, '') !== address) history.replaceState(history.state, '', address + window.location.search + window.location.hash);
  }, [p]);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => { if (p === null) document.title = 'Profile not available | Orphaned Films'; }, [p]);

  useEffect(() => {
    if (!p) return undefined;
    document.title = `${p.name || 'A profile'} | Orphaned Films`;
    let live = true;
    withPosters(p.favourites.map(identifier => ({ identifier }))).then(c => live && setFilms(c)).catch(() => {});
    return () => { live = false; };
  }, [p]);

  const patch = body => api(`/api/profile/${p.id}`, { method: 'PATCH', profile: me, body })
    .then(r => {
      if (r.status === 400) return r.json().catch(() => ({})).then(d => { if (d.error !== 'reserved') throw new Error('save failed'); setFailed(false); setReserved(true); setReset(n => n + 1); });
      if (!r.ok) throw new Error('save failed');
      setFailed(false); setReserved(false); load(); refreshProfile();
    })
    .catch(() => { setFailed(true); setReserved(false); setReset(n => n + 1); });
  const save = (field, e) => {
    const value = e.target.value.trim();
    if (value !== (p[field] || '')) patch({ [field]: value });
  };

  if (p === undefined) return <div className="min-h-screen bg-ink" />;
  if (p === null) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="gutter py-16"><p className="text-bone">This profile is not available.</p></main>
        <SiteFooter />
      </div>
    );
  }

  const link = isOwner ? editLink(window.location.origin, me) : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 3000); } catch { setManual(true); }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader current={`/u/${p.id}`} />
      <main className="gutter py-8 flex flex-col gap-8 text-bone">
        <div className="flex flex-col gap-3">
          {isOwner
            ? <input key={`n-${p.name}-${reset}`} defaultValue={p.name} placeholder="Your display name" maxLength={40} aria-label="Display name" className={`${FIELD} display text-3xl`} onBlur={e => save('name', e)} />
            : <h1 className="display text-3xl break-words">{p.name || 'A profile'}</h1>}
          {isOwner && <input key={`a-${p.archiveUser}-${reset}`} defaultValue={p.archiveUser} maxLength={60} placeholder="Archive.org username (optional)" aria-label="Archive.org username" className={FIELD} onBlur={e => save('archiveUser', e)} />}
          {isOwner && <HandleField key={p.handle || ''} profile={me} current={p.handle || ''} archiveUser={p.archiveUser} onSaved={() => { load(); refreshProfile(); }} />}
          {failed && <p role="alert" className="text-sm text-signal">Could not save</p>}
          {reserved && <p role="alert" className="text-sm text-signal">That name is reserved.</p>}
          {p.archiveUser && <a className="nav-link" href={`/details/@${encodeURIComponent(p.archiveUser)}`}>@{p.archiveUser} on Archive.org</a>}
          <a className="nav-link hover:text-signal self-start" href={`mailto:${REPORT_TO}?subject=${encodeURIComponent('Report')}&body=${encodeURIComponent(window.location.href)}`}>Report</a>
        </div>
        <section>
          <h2 className="display text-xl">Channels</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {p.channels.map(c => (
              <li key={c.id}>
                <a className="underline hover:text-signal break-words" href={`/c/${c.id}`}>{c.name}</a>
                <span className="text-muted"> · {c.films} {c.films === 1 ? 'film' : 'films'}{isOwner && LABEL[c.status] ? ` · ${LABEL[c.status]}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
        {p.saved.length > 0 && (
          <section>
            <h2 className="display text-xl">Saved channels</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {p.saved.map(c => <li key={c.id}><a className="underline hover:text-signal break-words" href={`/c/${c.id}`}>{c.name}</a></li>)}
            </ul>
          </section>
        )}
        <section>
          <h2 className="display text-xl mb-3">Favourites</h2>
          <FilmGrid films={films} track="profile" />
        </section>
        {isOwner && (
          <section className="border border-line p-4">
            <h2 className="display text-xl">Your edit link</h2>
            <p className="text-sm mt-1">Open it on another device to edit there. Keep it private: anyone with it can edit your profile.</p>
            {newLink && <p role="status" className="text-sm mt-2 text-signal">Signing in gave this profile a new edit link. The old one no longer works.</p>}
            {(manual || newLink) && (
              <input readOnly value={link} aria-label="Your edit link" onFocus={e => e.target.select()}
                className="mt-3 w-full bg-ink border border-line px-2 py-2 font-mono text-xs text-bone" />
            )}
            <div className="mt-3"><Button onClick={copy}>{copied ? 'Copied' : 'Copy edit link'}</Button></div>
            {previous && (
              <button type="button" className="nav-link hover:text-signal mt-4 block" onClick={() => { if (switchBack()) window.location.assign(`/u/${readProfile().id}`); }}>
                Switch back to your other profile
              </button>
            )}
          </section>
        )}
        {isOwner && <Passkeys profile={me} />}
      </main>
      <SiteFooter />
    </div>
  );
}

const SAYS = { taken: 'That handle is taken. Try one of these:', reserved: 'That name is reserved.', invalid: 'Use 3–30 letters, numbers, hyphens or underscores.' };
// The owner's handle: a readable address for the profile, checked as it is typed
function HandleField({ profile: { id, key }, current, archiveUser, onSaved }) {
  const profile = useMemo(() => ({ id, key }), [id, key]);
  const [value, setValue] = useState(current);
  const [check, setCheck] = useState(null); // the server's answer for check.handle
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const handle = cleanHandle(value);
  const ask = useCallback(h => api(`/api/handle/${encodeURIComponent(h)}`, { profile })
    .then(r => (r.ok ? r.json() : null)).catch(() => null)
    .then(out => setCheck({ handle: h, ...(out || { unknown: true }) })), [profile]);
  useEffect(() => {
    if (!handle || handle === current) return undefined;
    const wait = setTimeout(() => ask(handle), 400);
    return () => clearTimeout(wait);
  }, [handle, current, ask]);
  const shown = handle && handle !== current && check?.handle === handle ? check : null;
  const ready = !!(shown?.available || shown?.unknown); // the server still checks on save
  const save = async (h) => {
    setBusy(true);
    const r = await api(`/api/profile/${profile.id}`, { method: 'PATCH', profile, body: { handle: h || null } }).catch(() => null);
    setBusy(false);
    if (r?.ok) { onSaved(); return; }
    const { error } = r?.status === 400 ? await r.json().catch(() => ({})) : {};
    setFailed(!SAYS[error]);
    if (SAYS[error]) ask(h);
  };
  const address = ready ? handle : current;
  const fill = h => { setValue(h); setFailed(false); };
  return (
    <div className="flex flex-col gap-1">
      <form className="flex items-center gap-3" onSubmit={e => { e.preventDefault(); if (ready && !busy) save(handle); }}>
        <label className="flex items-baseline flex-1 min-w-0 border-b border-line">
          <span className="text-muted">/u/</span>
          <input value={value} onChange={e => fill(e.target.value.toLowerCase())} maxLength={30} placeholder="handle (optional)" aria-label="Handle"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} className="bg-transparent text-bone w-full py-1 min-w-0" />
        </label>
        {shown?.available && <Check size={18} className="text-muted shrink-0" aria-label="Available" />}
        {ready && <Button variant="ghost" type="submit" disabled={busy} className="disabled:opacity-50">Save</Button>}
        {current && handle === current && <button type="button" className="nav-link hover:text-signal shrink-0" disabled={busy} onClick={() => save('')}>Remove</button>}
      </form>
      <div role="status" className="text-sm">
        {shown && !shown.available && !shown.unknown && <p className="text-signal">{SAYS[shown.reason]}</p>}
        {shown?.unknown && <p className="text-muted">Couldn't check that handle just now. You can still save it.</p>}
        {shown?.suggestions?.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            {shown.suggestions.map(s => <button key={s} type="button" className="text-bone underline hover:text-signal" onClick={() => fill(s)}>{s}</button>)}
          </div>
        )}
        {failed && <p className="text-signal">Could not save</p>}
      </div>
      {archiveUser && !value && toHandle(archiveUser) && (
        <button type="button" className="nav-link hover:text-signal self-start text-sm" onClick={() => fill(toHandle(archiveUser))}>Use @{archiveUser}</button>
      )}
      {address && <p className="text-sm text-muted">Anyone can find this profile at <a className="underline hover:text-signal" href={`/u/${address}`}>/u/{address}</a>.</p>}
    </div>
  );
}

const MAX_PASSKEYS = 5;
const ADDED = { cancelled: 'No passkey added.', full: 'Five is the most.', exists: 'This device already has a passkey for this profile.', failed: "Couldn't add a passkey." };
// The owner's passkeys: each signs in to this profile on any device that has it
function Passkeys({ profile: { id, key } }) {
  const profile = useMemo(() => ({ id, key }), [id, key]);
  const [keys, setKeys] = useState(null);
  const [state, setState] = useState(null); // busy | cancelled | full | exists | failed
  const [confirm, setConfirm] = useState(null); // the passkey waiting for a second tap on Remove
  const [removeFailed, setRemoveFailed] = useState(false);
  const reload = useCallback(() => listPasskeys(profile).then(setKeys), [profile]);
  useEffect(() => { reload(); }, [reload]);
  const add = async () => {
    setState('busy');
    const out = await protectProfile(profile);
    setState(out === 'ok' ? null : out);
    reload();
  };
  const remove = async (credential) => {
    setConfirm(null);
    setRemoveFailed(!(await removePasskey(profile, credential)));
    reload();
  };
  if (!keys) return null;
  const full = keys.length >= MAX_PASSKEYS;
  return (
    <section className="border border-line p-4">
      <h2 className="display text-xl">Passkeys</h2>
      <p className="text-sm mt-1">Sign in to this profile on any device that has your passkey. Each sign-in replaces your edit link, so copy the new one afterwards.</p>
      {keys.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {keys.map(k => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-3">
              <span>Passkey added {new Date(k.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              {confirm === k.id
                ? <>
                    <button type="button" className="nav-link text-signal hover:text-bone" onClick={() => remove(k.id)}>Remove it</button>
                    <button type="button" className="nav-link" onClick={() => setConfirm(null)}>Keep</button>
                  </>
                : <button type="button" className="nav-link hover:text-signal" onClick={() => setConfirm(k.id)}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
      {removeFailed && <p role="alert" className="text-sm text-signal mt-2">Could not remove</p>}
      {typeof window.PublicKeyCredential !== 'undefined' && (
        <div className="mt-3">
          <Button variant="ghost" onClick={add} disabled={full || state === 'busy'} className="disabled:opacity-50">Add a passkey</Button>
          <p role="status" className="text-sm text-muted mt-2">{full ? ADDED.full : ADDED[state] || ''}</p>
        </div>
      )}
    </section>
  );
}
