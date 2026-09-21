import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

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
    setHidden(true);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* private mode */ }
  };

  return (
    <div className="bg-yellow-400 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
        <p className="flex-1 min-w-0">
          <strong className="font-semibold">New: ask your AI assistant what to watch.</strong>{' '}
          <span className="hidden sm:inline">These films now have an MCP server for Claude, Cursor and friends.</span>{' '}
          <a href="/mcp.html" className="underline underline-offset-2 font-medium whitespace-nowrap hover:no-underline">See how it works</a>
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 p-1 rounded hover:bg-yellow-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-900"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
