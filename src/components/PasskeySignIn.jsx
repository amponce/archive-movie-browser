import React, { useState } from 'react';
import { signInWithPasskey } from '../services/passkey';

const NOTE = { none: 'No passkey found for this site.', cancelled: 'Sign-in cancelled.', failed: "Couldn't sign in." };
// A text button that signs in with a passkey and opens the profile; a short note says why not
export default function PasskeySignIn() {
  const [state, setState] = useState(null); // busy | none | cancelled | failed
  const go = async () => {
    setState('busy');
    const out = await signInWithPasskey();
    if (out?.id) window.location.href = `/u/${out.id}`;
    else setState(out);
  };
  return (
    <div className="relative shrink-0">
      <button type="button" className="nav-link" onClick={go} disabled={state === 'busy'} data-track="sign-in" aria-label="Sign in with a passkey">Sign in</button>
      <p role="status" className={NOTE[state] ? 'absolute right-0 top-full z-30 whitespace-nowrap bg-ink border border-line px-2 py-1 text-xs text-bone' : 'sr-only'}>{NOTE[state] || ''}</p>
    </div>
  );
}
