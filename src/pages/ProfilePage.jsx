import React, { useEffect } from 'react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import useProfile from '../hooks/useProfile';

// /u/<id>: for now, links to this browser's own channels
export default function ProfilePage({ slug }) {
  const { data } = useProfile();
  useEffect(() => { document.title = 'Profile | Orphaned Films'; }, []);
  const channels = data?.id === slug ? data.channels : [];
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="gutter py-8 flex flex-col gap-4">
        <h1 className="display text-3xl">Channels</h1>
        <ul className="flex flex-col gap-2">
          {channels.map(c => <li key={c.id}><a className="underline text-bone hover:text-signal" href={`/c/${c.id}`}>{c.name}</a></li>)}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
