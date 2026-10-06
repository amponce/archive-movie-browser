import React, { useEffect, useState } from 'react';
import { Ghost, X } from 'lucide-react';
import { track } from '../services/analytics';
import { tonight, bannerKey } from '../halloween/days';
import { loadPosterIndex } from '../services/posterIndex';

const DISMISSED_KEY = 'mcp-banner-dismissed';
// How long each message stays before the next one, while both are showing
export const SHOW_FOR = { halloween: 20_000, mcp: 15_000 };

const stored = key => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const store = key => { try { localStorage.setItem(key, '1'); } catch { /* private mode */ } };

// One-line announcement above the header. It scrolls away with the page (the header below it is
// the sticky part); each message stays gone once dismissed, and the footer keeps a permanent link
// to the MCP page. Not shown on phones, where it took too much of the first screen.
// Through October 31 (Pacific time) tonight's 31 Days of Horror film takes turns with the MCP
// server; hovering or focusing the banner holds the current message.
export default function McpBanner() {
  const night = tonight(new Date());
  const [dayKey] = useState(() => bannerKey(new Date()));
  const [title, setTitle] = useState(null);
  const [gone, setGone] = useState(() => ({ halloween: stored(dayKey), mcp: stored(DISMISSED_KEY) }));
  const [current, setCurrent] = useState('halloween');
  const [held, setHeld] = useState(false);
  useEffect(() => { if (night) loadPosterIndex().then(index => setTitle(index[night.film]?.t || null)); }, [night?.film]);

  const showing = [night && title && !gone.halloween && 'halloween', !gone.mcp && 'mcp'].filter(Boolean);
  const active = showing.includes(current) ? current : showing[0];
  useEffect(() => {
    if (showing.length < 2 || held) return undefined;
    const t = setTimeout(() => setCurrent(active === 'halloween' ? 'mcp' : 'halloween'), SHOW_FOR[active]);
    return () => clearTimeout(t);
  }, [active, held, showing.length]);
  if (!active) return null;

  const dismiss = () => {
    if (active === 'mcp') { track('MCP banner', { action: 'dismissed' }); store(DISMISSED_KEY); } else store(dayKey);
    setGone(g => ({ ...g, [active]: true }));
  };

  return (
    <div className="hidden sm:block bg-signal text-ink"
      onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
      <div className="gutter py-2 flex items-center gap-3 text-sm">
        <div key={active} aria-live="off" className="banner-in flex-1 min-w-0 flex items-center gap-3">
          {active === 'halloween'
            ? (
              <>
                <Ghost className="w-4 h-4 shrink-0" aria-hidden="true" />
                <p className="flex-1 min-w-0">
                  <strong className="font-mono text-xs tracking-[0.1em] uppercase">31 Days of Horror.</strong>{' '}
                  <a href="/halloween" data-track="halloween-banner" className="underline underline-offset-2 font-medium hover:no-underline inline-block py-2.5 -my-2.5">Tonight: {title} →</a>
                </p>
              </>
            )
            : (
              <p className="flex-1 min-w-0">
                <strong className="font-mono text-xs tracking-[0.1em] uppercase">MCP server.</strong>{' '}
                <span>Search and browse Archive.org films from Claude, Cursor and other MCP clients.</span>{' '}
                <a href="/mcp" onClick={() => track('MCP banner', { action: 'opened' })} className="underline underline-offset-2 font-medium whitespace-nowrap hover:no-underline inline-block py-2.5 -my-2.5">Set it up</a>
              </p>
            )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 p-2.5 -m-1.5 rounded hover:bg-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
