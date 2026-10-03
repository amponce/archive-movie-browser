import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import Button from '../ui/Button';
import { signInWithPasskey } from '../services/passkey';
import { SEEN } from './SaveLinkPanel';

const NOTE = { none: 'No passkey found for this site.', expired: 'That took too long. Try again.', cancelled: 'Sign-in cancelled.', failed: "Couldn't sign in." };
// A text button that signs in with a passkey and opens the profile; a short note says why not.
// `icon` shows an icon button on phones instead (the header, where width is tight).
export default function PasskeySignIn({ icon = false }) {
  const [state, setState] = useState(null); // busy | none | expired | cancelled | failed
  const go = async () => {
    setState('busy');
    const out = await signInWithPasskey();
    if (!out?.id) { setState(out); return; }
    // It already has a passkey, and the profile page shows the new link: no save-link panel
    try { localStorage.setItem(SEEN, '1'); } catch { /* private mode */ }
    window.location.href = `/u/${out.id}`;
  };
  const busy = state === 'busy';
  return (
    <div className="relative shrink-0">
      {icon && (
        <Button variant="ghost" onClick={go} disabled={busy} data-track="sign-in" aria-label="Sign in with a passkey" title="Sign in" className="w-11 px-0 sm:hidden">
          <LogIn size={16} aria-hidden="true" />
        </Button>
      )}
      <button type="button" className={`nav-link ${icon ? 'hidden sm:inline-block' : ''}`} onClick={go} disabled={busy} data-track="sign-in" aria-label="Sign in with a passkey">Sign in</button>
      <p role="status" className={NOTE[state] ? 'absolute right-0 top-full z-30 whitespace-nowrap bg-ink border border-line px-2 py-1 text-xs text-bone' : 'sr-only'}>{NOTE[state] || ''}</p>
    </div>
  );
}
