import React, { useState } from 'react';
import { signInWithPasskey } from '../services/passkey';
import { SEEN } from './SaveLinkPanel';

const NOTE = { none: 'No passkey found for this site.', expired: 'That took too long. Try again.', cancelled: 'Sign-in cancelled.', failed: "Couldn't sign in." };

// Signs in with a passkey and opens the profile; `note` says why not
export function usePasskeySignIn() {
  const [state, setState] = useState(null); // busy | none | expired | cancelled | failed
  const go = async () => {
    setState('busy');
    const out = await signInWithPasskey();
    if (!out?.id) { setState(out); return; }
    // It already has a passkey, and the profile page shows the new link: no save-link panel
    try { localStorage.setItem(SEEN, '1'); } catch { /* private mode */ }
    window.location.href = `/u/${out.id}`;
  };
  return { go, busy: state === 'busy', note: NOTE[state] || '' };
}

// A text button that signs in with a passkey and opens the profile; a short note says why not.
export default function PasskeySignIn() {
  const { go, busy, note } = usePasskeySignIn();
  return (
    <div className="relative shrink-0">
      <button type="button" className="nav-link" onClick={go} disabled={busy} data-track="sign-in" aria-label="Sign in with a passkey">Sign in</button>
      <p role="status" className={note ? 'absolute right-0 top-full z-30 whitespace-nowrap bg-ink border border-line px-2 py-1 text-xs text-bone' : 'sr-only'}>{note}</p>
    </div>
  );
}
