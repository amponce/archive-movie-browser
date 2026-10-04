import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { onStaleKey, readProfile } from '../services/profile';
import { forgetCurrentProfile } from '../hooks/useProfile';
import PasskeySignIn from './PasskeySignIn';

// Shown when an edit is refused because this browser's edit key was changed elsewhere
export default function StaleKeyNotice() {
  const [shown, setShown] = useState(false);
  useEffect(() => onStaleKey(async () => {
    // A profile that is gone, not opened elsewhere: forget it rather than ask to sign in to it
    const p = readProfile();
    const res = p && await fetch(`/api/profile/${p.id}`).catch(() => null);
    if (res?.status === 404) { forgetCurrentProfile(); return; }
    setShown(true);
  }), []);
  if (!shown) return null;
  return (
    <div role="alert" className="fixed top-4 inset-x-4 sm:left-auto sm:w-96 z-50 bg-ink border border-signal p-4 text-bone flex items-start gap-3">
      <div className="flex-1">
        <p className="text-sm">This profile was opened on another device. Open your edit link or sign in with a passkey.</p>
        {typeof window.PublicKeyCredential !== 'undefined' && <PasskeySignIn />}
      </div>
      <button type="button" onClick={() => setShown(false)} aria-label="Dismiss" className="shrink-0 p-2.5 -m-2.5 text-muted hover:text-bone">
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
