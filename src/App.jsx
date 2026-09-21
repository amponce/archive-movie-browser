import React, { Suspense, lazy } from 'react';
import ArchiveMovieBrowser from './components/ArchiveMovieBrowser';

// Three pages do not need a router: the path picks the page, and links between them are
// ordinary links. The two side pages load on demand so the film browser stays small.
const PAGES = {
  '/mcp': lazy(() => import('./pages/McpPage')),
  '/stats': lazy(() => import('./pages/StatsPage')),
};

export function pageFor(pathname) {
  return PAGES[pathname.replace(/\/+$/, '')] || null;
}

export default function App() {
  const Page = pageFor(window.location.pathname);
  if (!Page) return <ArchiveMovieBrowser />;
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900" />}>
      <Page />
    </Suspense>
  );
}
