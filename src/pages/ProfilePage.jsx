import React, { useCallback, useEffect, useRef, useState } from 'react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import Button from '../ui/Button';
import { FilmGrid, withPosters } from './ArchiveListPage';
import { api, readProfile, editLink } from '../services/profile';
import { refreshProfile } from '../hooks/useProfile';

const LABEL = { unlisted: 'Unlisted', submitted: 'In review', public: 'Public', featured: 'Featured' };
const FIELD = 'bg-transparent border-b border-line text-bone w-full py-1';

// /u/<id>: a profile's name, channels, saved channels and favourites. Its owner can edit the
// name and Archive.org username and copy the edit link.
export default function ProfilePage({ slug }) {
  const [p, setP] = useState(undefined);
  const [films, setFilms] = useState([]);
  const [manual, setManual] = useState(false); // the clipboard was not available
  const [copied, setCopied] = useState(false);
  const me = readProfile();
  const isOwner = me?.id === slug;

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

  useEffect(() => {
    if (!p) return undefined;
    document.title = `${p.name || 'A profile'} | Orphaned Films`;
    let live = true;
    withPosters(p.favourites.map(identifier => ({ identifier }))).then(c => live && setFilms(c));
    return () => { live = false; };
  }, [p]);

  const patch = body => api(`/api/profile/${slug}`, { method: 'PATCH', profile: me, body })
    .then(() => { load(); refreshProfile(); }).catch(() => {});
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
      <SiteHeader />
      <main className="gutter py-8 flex flex-col gap-8 text-bone">
        <div className="flex flex-col gap-3">
          {isOwner
            ? <input key={`n-${p.name}`} defaultValue={p.name} placeholder="Your display name" maxLength={40} aria-label="Display name" className={`${FIELD} display text-3xl`} onBlur={e => save('name', e)} />
            : <h1 className="display text-3xl break-words">{p.name || 'A profile'}</h1>}
          {isOwner && <input key={`a-${p.archiveUser}`} defaultValue={p.archiveUser} placeholder="Archive.org username (optional)" aria-label="Archive.org username" className={FIELD} onBlur={e => save('archiveUser', e)} />}
          {p.archiveUser && <a className="nav-link" href={`/details/@${encodeURIComponent(p.archiveUser)}`}>@{p.archiveUser} on Archive.org</a>}
        </div>
        <section>
          <h2 className="display text-xl">Channels</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {p.channels.map(c => (
              <li key={c.id}>
                <a className="underline hover:text-signal" href={`/c/${c.id}`}>{c.name}</a>
                <span className="text-muted"> · {c.films} {c.films === 1 ? 'film' : 'films'}{isOwner && LABEL[c.status] ? ` · ${LABEL[c.status]}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
        {p.saved.length > 0 && (
          <section>
            <h2 className="display text-xl">Saved channels</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {p.saved.map(c => <li key={c.id}><a className="underline hover:text-signal" href={`/c/${c.id}`}>{c.name}</a></li>)}
            </ul>
          </section>
        )}
        <section>
          <h2 className="display text-xl mb-3">Favourites</h2>
          <FilmGrid films={films} track="profile" saves />
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
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
