import React, { useEffect, useRef, useState } from 'react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import Button from '../ui/Button';
import ContactEmail from '../ui/ContactEmail';

const KINDS = [['idea', 'An idea'], ['bug', 'Something broken'], ['other', 'Anything else']];
const SAYS = { 429: "That's a lot of notes in an hour. Try again a bit later.", 403: "We couldn't confirm this came from a person. Try sending again.", check: "The spam check didn't load. Reload the page to try again.", error: "Couldn't send that. Try again in a moment." };
// Cloudflare Turnstile keeps bots out; it only asks for a click when a visitor looks automated.
// Locally, Cloudflare's test key (always passes) stands in for the site's own.
const SITE_KEY = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? '1x00000000000000000000AA' : '0x4AAAAAAFYlHPztLzTYmhl8';
const TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function useTurnstile(box, onToken) {
  useEffect(() => {
    let id;
    const draw = () => {
      if (!box.current) return;
      id = window.turnstile.render(box.current, {
        sitekey: SITE_KEY, action: 'feedback', appearance: 'interaction-only',
        callback: t => onToken(t), 'expired-callback': () => onToken(null), 'error-callback': () => onToken(false),
      });
    };
    if (window.turnstile) draw();
    else {
      const script = Object.assign(document.createElement('script'), { src: TURNSTILE, async: true });
      script.onload = draw;
      script.onerror = () => onToken(false);
      document.head.append(script);
    }
    return () => { if (id !== undefined) window.turnstile?.remove(id); };
  }, [box, onToken]);
}

// The page the footer link came from, if it is on this site; the browser's own parser decides,
// so tricks like '/\t/elsewhere' that become '//elsewhere' are caught
function sitePath(raw, origin = window.location.origin) {
  if (!raw?.startsWith('/')) return null;
  try {
    const url = new URL(raw, origin);
    return url.origin === origin ? url.pathname + url.search : null;
  } catch { return null; }
}

// /feedback: a short note to the maintainer, no account. The footer link passes the page it was on.
export default function FeedbackPage() {
  const [kind, setKind] = useState('idea');
  const [state, setState] = useState(null); // 'busy' | 'sent' | 429 | 403 | 'check' | 'error'
  const [token, setToken] = useState(null);
  const box = useRef(null);
  const [onToken] = useState(() => t => { setToken(t || null); if (t === false) setState('check'); });
  useTurnstile(box, onToken);
  useEffect(() => { document.title = 'Feedback | Orphaned Films'; }, []);
  const from = sitePath(new URLSearchParams(window.location.search).get('from'));

  const send = async (e) => {
    e.preventDefault();
    const message = new FormData(e.currentTarget).get('message');
    setState('busy');
    const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, message, page: from, token }) }).catch(() => null);
    setState(res?.ok ? 'sent' : [429, 403].includes(res?.status) ? res.status : 'error');
    // A token works once, so a failed send gets a fresh one
    if (!res?.ok) { setToken(null); window.turnstile?.reset(box.current); }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader current="/feedback" />
      <main className="gutter py-12 flex flex-col gap-8 max-w-[72ch]">
        <h1 className="display text-4xl sm:text-5xl">Feedback</h1>
        {state === 'sent' ? (
          <p className="text-lg text-muted leading-relaxed">Thanks, we got it.{from && <> <a href={from} className="underline text-bone hover:text-signal">Back to where you were</a>.</>}</p>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-6">
            <p className="text-lg text-muted leading-relaxed">An idea, something that isn't working, or anything else. No account needed.</p>
            <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
              <legend className="sr-only">What kind of note</legend>
              {KINDS.map(([value, name]) => (
                <label key={value} className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer">
                  <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="accent-signal" />
                  <span className={kind === value ? 'text-bone' : 'text-muted'}>{name}</span>
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-2">
              <span className="label">{kind === 'bug' ? 'What happened, and on which page?' : 'Your note'}</span>
              <textarea name="message" required maxLength={2000} rows={6} className="bg-transparent border border-line text-bone p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal" />
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" disabled={state === 'busy' || !token} className="disabled:opacity-50">Send</Button>
              {SAYS[state] && <span role="status" className="text-sm text-muted">{SAYS[state]}</span>}
            </div>
            <p className="text-sm text-dim">Notes are read by the maintainer and not published. For a reply, email <ContactEmail />.</p>
          </form>
        )}
        <div ref={box} />
      </main>
      <SiteFooter />
    </div>
  );
}
