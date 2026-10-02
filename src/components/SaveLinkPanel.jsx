import React, { useState } from 'react';
import useProfile from '../hooks/useProfile';
import { editLink } from '../services/profile';
import Button from '../ui/Button';

const SEEN = 'profile-link-seen';
const seen = () => { try { return !!localStorage.getItem(SEEN); } catch { return true; } };

export default function SaveLinkPanel() {
  const { profile, data } = useProfile();
  const [closed, setClosed] = useState(seen);
  const [later, setLater] = useState(false); // hides it for this page only
  const [manual, setManual] = useState(false); // the clipboard was not available
  if (closed || later || !profile || !data || (data.channels.length < 1 && data.favourites.length < 3)) return null;
  const link = editLink(window.location.origin, profile);
  const done = () => { try { localStorage.setItem(SEEN, '1'); } catch { /* ignore */ } setClosed(true); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); done(); } catch { setManual(true); }
  };
  return (
    <aside role="region" aria-label="Save your edit link" className="fixed bottom-4 inset-x-4 sm:left-auto sm:w-96 z-40 bg-ink border border-line p-4 text-bone">
      <p className="font-semibold">Save your edit link</p>
      <p className="text-sm mt-1">It's the only way back to your channels and favourites on another device, or if this browser clears its data. Nobody else can edit without it.</p>
      {manual && (
        <input readOnly value={link} aria-label="Your edit link" onFocus={(e) => e.target.select()}
          className="mt-3 w-full bg-ink border border-line px-2 py-2 font-mono text-xs text-bone" />
      )}
      <div className="flex flex-wrap gap-x-2 mt-3">
        <Button onClick={copy}>Copy link</Button>
        <a className="nav-link" href={`mailto:?subject=${encodeURIComponent('My Orphaned Films edit link')}&body=${encodeURIComponent(link)}`} onClick={done}>Email it to myself</a>
        <button type="button" className="nav-link ml-auto" onClick={() => setLater(true)}>Later</button>
      </div>
    </aside>
  );
}
