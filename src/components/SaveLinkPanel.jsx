import React, { useState } from 'react';
import useProfile from '../hooks/useProfile';
import { editLink } from '../services/profile';
import Button from '../ui/Button';

const SEEN = 'profile-link-seen';
const seen = () => { try { return !!localStorage.getItem(SEEN); } catch { return true; } };

export default function SaveLinkPanel() {
  const { profile, data } = useProfile();
  const [closed, setClosed] = useState(seen);
  if (closed || !profile || !data || (data.channels.length < 1 && data.favourites.length < 3)) return null;
  const link = editLink(window.location.origin, profile);
  const done = () => { try { localStorage.setItem(SEEN, '1'); } catch { /* ignore */ } setClosed(true); };
  return (
    <aside role="dialog" aria-label="Save your edit link" className="fixed bottom-4 inset-x-4 sm:left-auto sm:w-96 z-40 bg-ink border border-line p-4 text-bone">
      <p className="font-semibold">Save your edit link</p>
      <p className="text-sm mt-1">It's the only way back to your channels on another device, or if this browser clears its data. Nobody else can edit without it.</p>
      <div className="flex gap-2 mt-3">
        <Button onClick={() => { navigator.clipboard?.writeText(link); done(); }}>Copy link</Button>
        <a className="nav-link" href={`mailto:?subject=${encodeURIComponent('My Orphaned Films edit link')}&body=${encodeURIComponent(link)}`} onClick={done}>Email it to myself</a>
        <button type="button" className="nav-link ml-auto" onClick={done}>Later</button>
      </div>
    </aside>
  );
}
