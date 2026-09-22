import React from 'react';
import Button from '../ui/Button';
import SearchField from '../ui/SearchField';
import { spin } from '../services/reel';

const NAV = [
  ['/', 'Tonight'],
  ['/tv', 'TV'],
  ['/browse?genre=Horror', 'Horror'],
  ['/browse', 'Browse'],
  ['/lists', 'Lists'],
  ['/mcp', 'MCP'],
];

export function Logo() {
  return (
    <a href="/" className="flex flex-col gap-0.5 shrink-0">
      <span className="flex items-center gap-2.5">
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="2" y="2" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2.5" /><rect x="7" y="7" width="14" height="14" rx="1.5" fill="currentColor" /><rect x="19" y="4.5" width="4" height="3" rx="1" className="fill-ink" /></svg>
        <span className="font-display font-black uppercase text-[28px] leading-[0.9] tracking-[0.02em]">Orphaned Films</span>
      </span>
      <span className="label hidden sm:block pl-[34px]">Forgotten films, found</span>
    </a>
  );
}

// The same header on every page: name, nav, search, spin.
// On phones the same links sit in a scrollable row under the search box: no drawer to open,
// nothing to get stuck. It stops scaling past eight or so destinations. `search` replaces the plain search
// box when a page has a richer one (the browser passes its type-ahead). `current` is the nav
// path to mark.
export default function SiteHeader({ current = '/', search, children }) {
  return (
    <header className="rule">
      <div className="gutter flex flex-wrap items-center justify-between gap-x-6 gap-y-4 py-5">
        <Logo />
        <nav className="hidden md:flex items-center gap-6" aria-label="Site">
          {NAV.map(([href, name]) => (
            <a key={href} href={href} className={`nav-link ${href === current ? 'text-bone' : ''}`} aria-current={href === current ? 'page' : undefined}>{name}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-none md:w-[240px] xl:w-[300px]">{search || <SearchField />}</div>
          <Button variant="light" onClick={spin} aria-label="Spin the reel: a random film">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 3h5v5" /><path d="M4 20L21 3" /><path d="M21 16v5h-5" /><path d="M15 15l6 6" /><path d="M4 4l5 5" /></svg>
            <span className="hidden sm:inline">Spin the reel</span><span className="sm:hidden">Spin</span>
          </Button>
        </div>
      </div>
      <nav className="md:hidden gutter flex gap-5 overflow-x-auto pb-3 -mt-1" aria-label="Site">
        {NAV.map(([href, name]) => (
          <a key={href} href={href} className={`nav-link shrink-0 ${href === current ? 'text-bone' : ''}`} aria-current={href === current ? 'page' : undefined}>{name}</a>
        ))}
      </nav>
      {children}
    </header>
  );
}
