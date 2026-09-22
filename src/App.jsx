import React, { Suspense, lazy } from 'react';
import ArchiveMovieBrowser from './components/ArchiveMovieBrowser';

// A few pages do not need a router: the path picks the page, and links between them are
// ordinary links. The side pages load on demand so the film browser stays small.
const PAGES = {
  '/': lazy(() => import('./pages/HomePage')),
  '/tv': lazy(() => import('./pages/TvPage')),
  '/mcp': lazy(() => import('./pages/McpPage')),
  '/stats': lazy(() => import('./pages/StatsPage')),
  '/lists': lazy(() => import('./pages/ListsPage')),
};

// '/lists/noir-you-can-finish-tonight' -> the lists page with that slug.
// The front page is the programme; '/browse', and '/' with filters or a #film link from before
// the front page existed, is the film browser (null).
// ponytail: old '/?genre=' and '/#film' links keep rendering the browser at '/' instead of
// redirecting; once the MCP and shared links all say /browse, redirect and drop the case.
export function pageFor(pathname, search = '', hash = '') {
  const path = pathname.replace(/\/+$/, '');
  if (path === '' || path === '/browse') return search || (path === '' && hash.length > 1) || path ? null : { Page: PAGES['/'] };
  const list = path.match(/^\/lists\/([a-z0-9-]+)$/);
  if (list) return { Page: PAGES['/lists'], slug: list[1] };
  return PAGES[path] ? { Page: PAGES[path] } : null;
}

export default function App() {
  const match = pageFor(window.location.pathname, window.location.search, window.location.hash);
  if (!match) return <ArchiveMovieBrowser />;
  const { Page, slug } = match;
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>
      <Page slug={slug} />
    </Suspense>
  );
}
