import React, { useState, useEffect } from 'react';
import useProfile from '../hooks/useProfile';
import { editLink, justStarted } from '../services/profile';
import { protectProfile, listPasskeys } from '../services/passkey';
import Button from '../ui/Button';

export const SEEN = 'profile-link-seen';
const seen = () => { try { return !!localStorage.getItem(SEEN); } catch { return true; } };

export default function SaveLinkPanel() {
  const { profile, data } = useProfile();
  const [closed, setClosed] = useState(seen);
  const [later, setLater] = useState(false); // hides it for this page only
  const [manual, setManual] = useState(false); // the clipboard was not available
  const [passkey, setPasskey] = useState(null); // busy | ok | cancelled | failed
  const [hasPasskey, setHasPasskey] = useState(null); // a passkey already protects the profile
  const id = profile?.id;
  const key = profile?.key;
  useEffect(() => {
    if (closed || !id || !key) return undefined;
    let live = true;
    listPasskeys({ id, key }).then(list => { if (live) setHasPasskey(Array.isArray(list) && list.length > 0); });
    return () => { live = false; };
  }, [closed, id, key]);
  // A profile started from the header is offered the link at once; others once they hold something
  if (closed || later || hasPasskey !== false || !profile || !data || (!justStarted(profile.id) && data.channels.length < 1 && data.favourites.length < 3)) return null;
  const link = editLink(window.location.origin, profile);
  const canPasskey = typeof window.PublicKeyCredential !== 'undefined';
  const done = () => { try { localStorage.setItem(SEEN, '1'); } catch { /* ignore */ } setClosed(true); };
  const canSend = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  // The system share sheet: Mail, Messages, Notes, a password manager, wherever the person keeps things
  const send = async () => {
    try {
      await navigator.share({ title: 'My Orphaned Films edit link (private)', text: 'The key to my Orphaned Films profile. Keep it private.', url: link });
      done();
    } catch { /* cancelled */ }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); done(); } catch { setManual(true); }
  };
  const protect = async () => {
    setPasskey('busy');
    const out = await protectProfile(profile);
    if (out === 'ok') { try { localStorage.setItem(SEEN, '1'); } catch { /* ignore */ } }
    setPasskey(out === 'ok' || out === 'cancelled' ? out : 'failed');
  };
  if (passkey === 'ok') {
    return (
      <aside role="region" aria-label="Save your edit link" className="fixed bottom-4 inset-x-4 sm:left-auto sm:w-96 z-40 bg-ink border border-line p-4 text-bone">
        <p role="status" className="text-sm">Protected. Sign in with your passkey on any device.</p>
        <div className="mt-3"><Button variant="ghost" onClick={() => setClosed(true)}>Close</Button></div>
      </aside>
    );
  }
  return (
    <aside role="region" aria-label="Save your edit link" className="fixed bottom-4 inset-x-4 sm:left-auto sm:w-96 z-40 bg-ink border border-line p-4 text-bone">
      <p className="font-semibold">Save your edit link</p>
      <p className="text-sm mt-1">This link is the key to your profile, and only you have it. Keep it safe and never share it: anyone with it can change or delete your profile. To show people a channel, share the channel's link instead.</p>
      {manual && (
        <input readOnly value={link} aria-label="Your edit link" onFocus={(e) => e.target.select()}
          className="mt-3 w-full bg-ink border border-line px-2 py-2 font-mono text-xs text-bone" />
      )}
      {canPasskey && (
        <div className="mt-3">
          <Button onClick={protect} disabled={passkey === 'busy'} className="disabled:opacity-50">Protect with a passkey</Button>
          {passkey === 'cancelled' && <p role="status" className="text-sm text-muted mt-2">No passkey added.</p>}
          {passkey === 'failed' && <p role="status" className="text-sm text-signal mt-2">Couldn't add a passkey. Copy your edit link instead.</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-x-2 mt-3">
        <Button variant={canPasskey ? 'ghost' : 'primary'} onClick={copy}>Copy link</Button>
        {canSend && <button type="button" className="nav-link" onClick={send}>Send to myself</button>}
        <button type="button" className="nav-link ml-auto" onClick={() => setLater(true)}>Later</button>
      </div>
    </aside>
  );
}
