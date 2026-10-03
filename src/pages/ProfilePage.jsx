import React, { useCallback, useEffect, useRef, useState } from 'react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import Button from '../ui/Button';
import { FilmGrid, withPosters } from './ArchiveListPage';
import { api, readProfile, editLink, readPrevious, switchBack } from '../services/profile';
import { refreshProfile } from '../hooks/useProfile';
import { protectProfile, listPasskeys, removePasskey } from '../services/passkey';

const LABEL = { unlisted: 'Unlisted', submitted: 'In review', public: 'Public', featured: 'Featured' };
const FIELD = 'bg-transparent border-b border-line text-bone w-full py-1';
// Put together here so the address appears nowhere as one string
const REPORT_TO = ['hello', 'orphanedfilms.com'].join('@');

// /u/<id>: a profile's name, channels, saved channels and favourites. Its owner can edit the
// name and Archive.org username and copy the edit link.
export default function ProfilePage({ slug }) {
  const [p, setP] = useState(undefined);
  const [films, setFilms] = useState([]);
  const [manual, setManual] = useState(false); // the clipboard was not available
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false); // the last save did not go through
  const [reset, setReset] = useState(0); // remounts the inputs back to the stored values
  const me = readProfile();
  const isOwner = me?.id === slug;
  const previous = isOwner && readPrevious();

  const loads = useRef(0);
  const load = useCallback(() => {
    const n = ++loads.current;
    return api(`/api/profile/${slug}`)
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(data => { if (n === loads.current) setP(data); });
  }, [slug]);
  useEffect(() => { load(); }, [load]);

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

  const patch = body => api(`/api/profile/${slug}`, { method: 'PATCH', profile: me, body })
    .then(r => {
      if (!r.ok) throw new Error('save failed');
      setFailed(false); load(); refreshProfile();
    })
    .catch(() => { setFailed(true); setReset(n => n + 1); });
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
          {failed && <p role="alert" className="text-sm text-signal">Could not save</p>}
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
            {manual && (
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

const MAX_PASSKEYS = 5;
const ADDED = { cancelled: 'No passkey added.', full: 'Five is the most.', failed: "Couldn't add a passkey." };
// The owner's passkeys: each signs in to this profile on any device that has it
function Passkeys({ profile }) {
  const [keys, setKeys] = useState(null);
  const [state, setState] = useState(null); // busy | cancelled | full | failed
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
  const remove = async (id) => {
    setConfirm(null);
    setRemoveFailed(!(await removePasskey(profile, id)));
    reload();
  };
  if (!keys) return null;
  const full = keys.length >= MAX_PASSKEYS;
  return (
    <section className="border border-line p-4">
      <h2 className="display text-xl">Passkeys</h2>
      <p className="text-sm mt-1">Sign in to this profile on any device with your passkey. Your edit link keeps working.</p>
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
