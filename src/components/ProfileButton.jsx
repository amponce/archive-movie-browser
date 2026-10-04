import React, { useEffect, useRef, useState } from 'react';
import { CircleUserRound } from 'lucide-react';
import Button from '../ui/Button';
import useProfile from '../hooks/useProfile';
import { ensureProfile, markStarted } from '../services/profile';
import { listPasskeys } from '../services/passkey';
import { usePasskeySignIn } from './PasskeySignIn';

// The header's way in. With a passkey-protected profile it opens the profile's page; with an
// unprotected one, a small menu opens the page or signs in with a passkey (to get back to
// another profile); without one, a small panel starts a profile or signs in with a passkey.
// `current` is the page's nav path.
export default function ProfileButton({ current }) {
  const { profile, data } = useProfile();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const passkey = usePasskeySignIn();
  const [protectedProfile, setProtectedProfile] = useState(null);
  const root = useRef(null);
  const button = useRef(null);
  const first = useRef(null);
  // The word shows where the header has room for it: not on phones, and not from xl to 1400px,
  // where nav, search and buttons share one full line
  const label = <><CircleUserRound size={16} aria-hidden="true" /><span className="hidden sm:inline xl:hidden min-[1400px]:inline">Profile</span></>;
  const shape = 'w-11 px-0 sm:w-auto sm:px-5 xl:w-11 xl:px-0 min-[1400px]:w-auto min-[1400px]:px-5';

  useEffect(() => {
    if (!open) return undefined;
    first.current?.focus();
    const onDown = e => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); button.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [open]);

  const id = profile?.id;
  const key = profile?.key;
  useEffect(() => {
    if (!id || !key) return undefined;
    let live = true;
    listPasskeys({ id, key }).then(list => { if (live) setProtectedProfile(Array.isArray(list) ? list.length > 0 : null); });
    return () => { live = false; };
  }, [id, key]);

  const canPasskey = typeof window.PublicKeyCredential !== 'undefined';
  const signIn = canPasskey && (
    <>
      <Button variant="ghost" onClick={passkey.go} disabled={passkey.busy} data-track="profile-passkey" className="w-full disabled:opacity-50">Sign in with a passkey</Button>
      <p role="status" className={passkey.note ? 'text-sm text-muted' : 'sr-only'}>{passkey.note}</p>
    </>
  );

  if (profile) {
    const own = current === `/u/${profile.id}`;
    const href = `/u/${data?.handle || profile.id}`;
    if (protectedProfile !== false || !canPasskey) {
      return (
        <Button variant="ghost" href={href} data-track="profile-button" aria-label="Your profile" title="Your profile" aria-current={own ? 'page' : undefined} className={`${shape} ${own ? 'border-bone' : ''}`}>
          {label}
        </Button>
      );
    }
    return (
      <div ref={root} className="relative shrink-0">
        <Button ref={button} variant="ghost" onClick={() => setOpen(o => !o)} data-track="profile-button" aria-label="Your profile" title="Your profile" aria-expanded={open} aria-haspopup="dialog" className={`${shape} ${own ? 'border-bone' : ''}`}>
          {label}
        </Button>
        {open && (
          <div role="dialog" aria-label="Your profile" className="absolute right-0 top-full mt-2 w-72 bg-ink border border-line z-30 p-4 text-bone flex flex-col gap-3">
            <Button ref={first} href={href} data-track="profile-open" aria-current={own ? 'page' : undefined} className="w-full">Your profile</Button>
            {signIn}
          </div>
        )}
      </div>
    );
  }

  const start = async () => {
    setStarting(true);
    setFailed(false);
    try {
      const p = await ensureProfile();
      markStarted(p.id);
      window.location.href = `/u/${p.id}`;
    } catch {
      setStarting(false);
      setFailed(true);
    }
  };

  return (
    <div ref={root} className="relative shrink-0">
      <Button ref={button} variant="ghost" onClick={() => setOpen(o => !o)} data-track="profile-button" aria-label="Your profile" title="Your profile" aria-expanded={open} aria-haspopup="dialog" className={shape}>
        {label}
      </Button>
      {open && (
        <div role="dialog" aria-label="Your profile" className="absolute right-0 top-full mt-2 w-72 bg-ink border border-line z-30 p-4 text-bone flex flex-col gap-3">
          <Button ref={first} onClick={start} disabled={starting} data-track="profile-start" className="w-full disabled:opacity-50">Start your profile</Button>
          <p className="text-sm">Save films, build channels. No email, no password.</p>
          {failed && <p role="status" className="text-sm text-signal">We couldn't start it just now. Try again.</p>}
          {signIn}
          <p className="text-xs text-muted">Have an edit link? Open it on this device.</p>
        </div>
      )}
    </div>
  );
}
