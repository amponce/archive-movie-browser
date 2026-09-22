import React, { Suspense, lazy } from 'react';
import ArchiveMovieBrowser from './components/ArchiveMovieBrowser';

// A few pages do not need a router: the path picks the page, and links between them are
// ordinary links. The side pages load on demand so the film browser stays small.
const PAGES = {
  '/mcp': lazy(() => import('./pages/McpPage')),
  '/stats': lazy(() => import('./pages/StatsPage')),
  '/lists': lazy(() => import('./pages/ListsPage')),
};

// '/lists/noir-you-can-finish-tonight' -> the lists page with that slug
export function pageFor(pathname) {
  const path = pathname.replace(/\/+$/, '');
  const list = path.match(/^\/lists\/([a-z0-9-]+)$/);
  if (list) return { Page: PAGES['/lists'], slug: list[1] };
  return PAGES[path] ? { Page: PAGES[path] } : null;
}

export default function App() {
  const match = pageFor(window.location.pathname);
  if (!match) return <ArchiveMovieBrowser />;
  const { Page, slug } = match;
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900" />}>
      <Page slug={slug} />
    </Suspense>
  );
}
