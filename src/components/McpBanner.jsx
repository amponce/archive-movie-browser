import React, { useState } from 'react';
import { X } from 'lucide-react';
import { track } from '../services/analytics';

const DISMISSED_KEY = 'mcp-banner-dismissed';

function wasDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

// One-line announcement above the header. It scrolls away with the page (the header below it is
// the sticky part) and stays gone once dismissed; the footer keeps a permanent link to the page.
export default function McpBanner() {
  const [hidden, setHidden] = useState(wasDismissed);
  if (hidden) return null;

  const dismiss = () => {
    track('MCP banner', { action: 'dismissed' });
    setHidden(true);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* private mode */ }
  };

  return (
    <div className="bg-signal text-ink">
      <div className="gutter py-2 flex items-center gap-3 text-sm">
        <p className="flex-1 min-w-0">
          <strong className="font-mono text-xs tracking-[0.1em] uppercase">New. MCP server.</strong>{' '}
          <span className="hidden sm:inline">Search and browse Archive.org films from Claude, Cursor and other MCP clients.</span>{' '}
          <a href="/mcp" onClick={() => track('MCP banner', { action: 'opened' })} className="underline underline-offset-2 font-medium whitespace-nowrap hover:no-underline">Set it up</a>
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 p-1 rounded hover:bg-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
