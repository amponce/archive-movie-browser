import React, { useEffect, useState } from 'react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';

const SITE = 'https://www.orphanedfilms.com';
const FEEDS = [
  { what: 'Channels', url: `${SITE}/api/tv/channels.m3u`, for: 'IPTV apps: Jellyfin, TiviMate, Kodi, Channels DVR. One entry per channel; each plays what is on it now.' },
  { what: 'TV guide (XMLTV)', url: `${SITE}/api/tv/guide.xml`, for: 'The schedule for the next three days, with a description and genre for every film, matched to the channels above.' },
  { what: 'Every film as a playlist', url: `${SITE}/api/tv/playlist.m3u`, for: 'VLC and other players: every channel’s films in order, to play straight through.' },
];
const APPS = [
  { name: 'Jellyfin', steps: [
    'Dashboard, then Live TV. Add a tuner device of type M3U and paste the channels address.',
    'Add a TV guide data provider of type XMLTV and paste the guide address.',
  ] },
  { name: 'TiviMate', steps: [
    'Add playlist, choose M3U playlist, and paste the channels address.',
    'The guide comes with it. If it doesn’t show, add the guide address under EPG sources.',
  ] },
  { name: 'Kodi', steps: [
    'Settings, then Add-ons, then Install from repository, then PVR clients. Install PVR IPTV Simple Client.',
    'Open it again and choose Configure. Kodi lists one entry, Migrated Add-on Config: choose that one. Don’t choose Add; a second copy of the add-on makes Kodi crash.',
    'Under General, put the channels address in M3U play list URL, then choose OK. The guide comes with it.',
    'Restart Kodi. From then on, the channels are on the home screen: choose TV, then Channels, or Guide for the schedule. In the guide, choose a channel’s name to watch what is on.',
  ], note: 'Crashing, or every channel twice? The add-on has extra copies. Choose Configure again and turn off every entry but one.' },
];

function Copy({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn-ghost shrink-0" data-track="iptv-copy"
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

// /iptv: the channels in other players, for anyone who would rather watch on a TV box
export default function IptvPage() {
  useEffect(() => { document.title = 'Channels in your IPTV app | Orphaned Films'; }, []);
  return (
    <div className="min-h-screen">
      <SiteHeader current="/tv" />
      <main className="gutter py-12 flex flex-col gap-10 max-w-[72ch]">
        <div className="flex flex-col gap-4">
          <h1 className="display text-4xl sm:text-5xl">The channels in your IPTV app</h1>
          <p className="text-lg text-muted leading-relaxed">
            Every channel on <a href="/tv" className="underline text-bone hover:text-signal">TV</a> is also a feed you can add to
            Jellyfin, TiviMate, Kodi or any player that takes an M3U playlist, with the guide beside it. Nothing to sign up for.
          </p>
        </div>

        <section aria-labelledby="feeds" className="flex flex-col gap-5">
          <h2 id="feeds" className="display text-2xl">The addresses</h2>
          {FEEDS.map(feed => (
            <div key={feed.url} className="flex flex-col gap-2">
              <span className="text-bone font-semibold">{feed.what}</span>
              <div className="flex items-center gap-3 min-w-0">
                <code className="font-mono text-sm text-bone bg-panel rounded px-3 py-2 break-all flex-1 min-w-0">{feed.url}</code>
                <Copy text={feed.url} />
              </div>
              <span className="text-muted text-sm leading-relaxed">{feed.for}</span>
            </div>
          ))}
        </section>

        <section aria-labelledby="apps" className="flex flex-col gap-5">
          <h2 id="apps" className="display text-2xl">Adding them</h2>
          <dl className="flex flex-col gap-4">
            {APPS.map(app => (
              <div key={app.name}>
                <dt className="text-bone font-semibold">{app.name}</dt>
                <dd className="text-muted leading-relaxed">
                  <ol className="list-decimal pl-5 flex flex-col gap-1">{app.steps.map(step => <li key={step}>{step}</li>)}</ol>
                  {app.note && <p className="mt-2">{app.note}</p>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-muted leading-relaxed">
            Menus move between versions; any app that asks for an M3U playlist and an XMLTV guide takes these two.
          </p>
        </section>

        <section aria-labelledby="how" className="flex flex-col gap-3">
          <h2 id="how" className="display text-2xl">How it plays</h2>
          <p className="text-muted leading-relaxed">
            The guide is the same schedule as the TV page. Tuning to a channel plays the film on it now, from its beginning,
            and when it ends your app moves on to the next one. The films stream straight from the Internet Archive, as they
            do here.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
