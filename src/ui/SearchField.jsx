import React from 'react';

// The plain search box for pages that are not the browser: submits to /browse?q=
export default function SearchField({ placeholder = 'Search films', className = '' }) {
  return (
    <form action="/browse" method="get" className={className}>
      <label className="field">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="text-dim shrink-0"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input name="q" type="search" placeholder={placeholder} aria-label="Search films" />
      </label>
    </form>
  );
}
