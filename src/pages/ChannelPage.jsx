import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import Button from '../ui/Button';
import { FilmGrid, withPosters } from './ArchiveListPage';
import ChannelEditor from '../components/ChannelEditor';
import SubmitForReview from '../components/SubmitForReview';
import { api, readProfile, ensureProfile } from '../services/profile';
import useProfile, { refreshProfile } from '../hooks/useProfile';
import { channelView, channelLink, CHANNEL_VIEW_KEY } from '../services/channelView';

const TvPage = lazy(() => import('./TvPage'));
// Put together here so the address appears nowhere as one string
const REPORT_TO = ['hello', 'orphanedfilms.com'].join('@');
const storedView = () => { try { return localStorage.getItem(CHANNEL_VIEW_KEY); } catch { return null; } };

// /c/<id>: a community channel. It opens as the TV, tuned to this channel on the shared clock;
// under the set are its name, maker, notes and films, and for its owner the editor. As a list
// (?view=list, or chosen here and remembered) there is no set: the films come first.
export default function ChannelPage({ slug }) {
  const [channel, setChannel] = useState(undefined);
  const [cards, setCards] = useState([]);
  const [savedNow, setSaved] = useState(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState(() => channelView(window.location.search, storedView()));
  const { data: me } = useProfile();
  const saved = savedNow ?? !!me?.saved?.some(s => s.id === slug);

  // A reload that answers after a newer one is dropped
  const loads = useRef(0);
  const load = useCallback(() => {
    const n = ++loads.current;
    return api(`/api/channel/${slug}`, { profile: readProfile() })
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(c => { if (n === loads.current) setChannel(c); });
  }, [slug]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (channel) document.title = `${channel.name} | Orphaned Films`; }, [channel]);
  useEffect(() => {
    if (!channel) return undefined;
    let live = true;
    withPosters(channel.films.map(f => ({ identifier: f.film }))).then(c => live && setCards(c));
    return () => { live = false; };
  }, [channel]);

  // The same ids array while the films are unchanged, so an edit does not restart measuring
  const idsKey = channel ? channel.films.map(f => f.film).join('\n') : null;
  const ids = useMemo(() => (idsKey ? idsKey.split('\n') : []), [idsKey]);
  const shared = useMemo(() => channel && { id: `c-${channel.id}`, name: channel.name, ids }, [channel?.id, channel?.name, ids]);

  if (channel === undefined) return <div className="min-h-screen bg-ink" />;
  if (channel === null) {
    return (
      <div className="min-h-screen">
        <SiteHeader current="/tv" />
        <main className="gutter py-16"><p className="text-bone">This channel is not available.</p></main>
        <SiteFooter />
      </div>
    );
  }

  const isOwner = !!channel.ownerId && channel.ownerId === readProfile()?.id;
  const notes = Object.fromEntries(channel.films.filter(f => f.note).map(f => [f.film, f.note]));
  const titles = Object.fromEntries(cards.map(c => [c.id, c.title]));
  const share = () => { navigator.clipboard?.writeText(channelLink(window.location.origin, channel.id, view)); setCopied(true); setTimeout(() => setCopied(false), 3000); };
  const choose = (to) => {
    setView(to);
    try { localStorage.setItem(CHANNEL_VIEW_KEY, to); } catch { /* private mode */ }
    window.history.replaceState(null, '', channelLink('', channel.id, to));
  };
  const list = view === 'list';
  const grid = <FilmGrid films={cards} notes={notes} track="channel-film" saves source={`c-${channel.id}`} />;
  const toggleSave = async () => {
    try {
      const profile = await ensureProfile();
      const res = await api(`/api/channel/${channel.id}/save`, { method: saved ? 'DELETE' : 'PUT', profile });
      if (res.ok) { setSaved(!saved); refreshProfile(); }
    } catch { /* stays as it was */ }
  };

  const about = (
    <section className={`flex flex-col gap-4 ${list ? '' : 'pt-4 border-t border-line'}`} aria-label="About this channel">
      <div>
        <span className="eyebrow">Community channel</span>
        <h1 className="display text-3xl mt-1 break-words">{channel.name}</h1>
        {channel.owner && <p className="label mt-1">by {channel.owner}</p>}
        {channel.description && <p className="text-bone mt-3 max-w-prose whitespace-pre-line break-words">{channel.description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="seg" role="group" aria-label="View">
          <button type="button" aria-pressed={!list} onClick={() => choose('watch')} data-track="channel-view-watch">Watch</button>
          <button type="button" aria-pressed={list} onClick={() => choose('list')} data-track="channel-view-list">List</button>
        </div>
        <Button onClick={share} data-track="channel-share">{copied ? 'Link copied' : 'Copy link'}</Button>
        <Button variant="ghost" onClick={toggleSave} aria-pressed={saved} data-track="channel-save">{saved ? 'Saved' : 'Save channel'}</Button>
        <a className="nav-link hover:text-signal" href={`mailto:${REPORT_TO}?subject=${encodeURIComponent('Report')}&body=${encodeURIComponent(window.location.href)}`}>Report</a>
      </div>
      {list && grid}
      {isOwner
        ? (
          <>
            <ChannelEditor key={channel.id} channel={channel} titles={titles} onChange={load} />
            <SubmitForReview channel={channel} onChange={load} />
          </>
        )
        : !list && grid}
    </section>
  );

  if (list) {
    return (
      <div className="min-h-screen">
        <SiteHeader current="/tv" />
        <main className="gutter py-8">{about}</main>
        <SiteFooter />
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>
      <TvPage channel={shared}>{about}</TvPage>
    </Suspense>
  );
}
