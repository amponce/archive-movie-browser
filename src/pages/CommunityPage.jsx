import React, { useEffect, useState } from 'react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import { withPosters } from './ArchiveListPage';

function Card({ channel }) {
  return (
    <a href={`/c/${channel.id}`} className="block panel overflow-hidden hover:border-yellow-400/60">
      {channel.poster
        ? <img src={channel.poster} alt="" className="w-full aspect-[2/3] object-cover" loading="lazy" />
        : <div className="w-full aspect-[2/3] bg-panel" />}
      <div className="p-3">
        <p className="font-semibold text-bone break-words">{channel.name}</p>
        <p className="text-sm text-dim mt-1 break-words">{channel.films} {channel.films === 1 ? 'film' : 'films'}{channel.owner && ` · ${channel.owner}`}</p>
      </div>
    </a>
  );
}

function Group({ title, items }) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <h2 className="display text-2xl text-bone">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
        {items.map(c => <Card key={c.id} channel={c} />)}
      </div>
    </section>
  );
}

// /channels: community channels, the featured ones first
export default function CommunityPage() {
  const [channels, setChannels] = useState(null);
  useEffect(() => {
    document.title = 'Community channels | Orphaned Films';
    let live = true;
    fetch('/api/channels').then(r => r.json()).then(async ({ channels: list }) => {
      const cards = await withPosters(list.filter(c => c.firstFilm).map(c => ({ identifier: c.firstFilm }))).catch(() => []);
      const byId = Object.fromEntries(cards.map(c => [c.id, c]));
      if (live) setChannels(list.map(c => ({ ...c, poster: byId[c.firstFilm]?.poster || null })));
    }).catch(() => live && setChannels([]));
    return () => { live = false; };
  }, []);
  return (
    <div className="min-h-screen">
      <SiteHeader current="/channels" />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="display text-5xl sm:text-6xl leading-none text-bone mb-4">Community channels</h1>
        <p className="text-lg text-muted leading-relaxed">Build your own channel from any film here. Share it. If the mods like it, it's featured here.</p>
        {channels && (channels.length === 0
          ? <p className="text-muted mt-10">Channels made by viewers will appear here.</p>
          : (
            <>
              <Group title="Featured" items={channels.filter(c => c.status === 'featured')} />
              <Group title="More channels" items={channels.filter(c => c.status !== 'featured')} />
            </>
          ))}
      </main>
      <SiteFooter />
    </div>
  );
}
