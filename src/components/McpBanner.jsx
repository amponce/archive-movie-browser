import React, { useEffect, useState } from 'react';
import { Ghost, X } from 'lucide-react';
import { track } from '../services/analytics';
import { tonight, bannerKey } from '../halloween/days';
import { loadPosterIndex } from '../services/posterIndex';

const DISMISSED_KEY = 'mcp-banner-dismissed';

function wasDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

// One-line announcement above the header. It scrolls away with the page (the header below it is
// the sticky part) and stays gone once dismissed; the footer keeps a permanent link to the page.
// Not shown on phones, where it took too much of the first screen.
// Through October 31 (Pacific time) it is the 31 Days of Horror banner instead.
export default function McpBanner() {
  const night = tonight(new Date());
  return night ? <HalloweenBanner night={night} /> : <McpAnnouncement />;
}

// Tonight's film; dismissed for the day only
function HalloweenBanner({ night }) {
  const [key] = useState(() => bannerKey(new Date()));
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const [title, setTitle] = useState(null);
  useEffect(() => { loadPosterIndex().then(index => setTitle(index[night.film]?.t || null)); }, [night.film]);
  if (hidden || !title) return null;

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(key, '1'); } catch { /* private mode */ }
  };

  return (
    <div className="hidden sm:block bg-signal text-ink">
      <div className="gutter py-2 flex items-center gap-3 text-sm">
        <Ghost className="w-4 h-4 shrink-0" aria-hidden="true" />
        <p className="flex-1 min-w-0">
          <strong className="font-mono text-xs tracking-[0.1em] uppercase">31 Days of Horror.</strong>{' '}
          <a href="/halloween" data-track="halloween-banner" className="underline underline-offset-2 font-medium hover:no-underline inline-block py-2.5 -my-2.5">Tonight: {title} →</a>
        </p>
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

function McpAnnouncement() {
  const [hidden, setHidden] = useState(wasDismissed);
  if (hidden) return null;

  const dismiss = () => {
    track('MCP banner', { action: 'dismissed' });
    setHidden(true);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* private mode */ }
  };

  return (
    <div className="hidden sm:block bg-signal text-ink">
      <div className="gutter py-2 flex items-center gap-3 text-sm">
        <p className="flex-1 min-w-0">
          <strong className="font-mono text-xs tracking-[0.1em] uppercase">New MCP server.</strong>{' '}
          <span className="hidden sm:inline">Search and browse Archive.org films from Claude, Cursor and other MCP clients.</span>{' '}
          <a href="/mcp" onClick={() => track('MCP banner', { action: 'opened' })} className="underline underline-offset-2 font-medium whitespace-nowrap hover:no-underline inline-block py-2.5 -my-2.5">Set it up</a>
        </p>
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
