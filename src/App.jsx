import React, { Suspense, lazy } from 'react';
import ArchiveMovieBrowser from './components/ArchiveMovieBrowser';
import SaveLinkPanel from './components/SaveLinkPanel';
import StaleKeyNotice from './components/StaleKeyNotice';
import { parseSitePath, redirectFor } from './services/archiveUrl';
import { adoptFromLink } from './services/profile';
import { pageFor } from './services/pages';

// The side pages load on demand so the film browser stays small
const PAGES = {
  '/': lazy(() => import('./pages/HomePage')),
  '/tv': lazy(() => import('./pages/TvPage')),
  '/mcp': lazy(() => import('./pages/McpPage')),
  '/stats': lazy(() => import('./pages/StatsPage')),
  '/lists': lazy(() => import('./pages/ListsPage')),
  '/takedown': lazy(() => import('./pages/TakedownPage')),
  '/from-archive': lazy(() => import('./pages/FromArchivePage')),
  '/iptv': lazy(() => import('./pages/IptvPage')),
  '/collection': lazy(() => import('./pages/CollectionPage')),
  '/details': lazy(() => import('./pages/ArchiveListPage')),
  '/channels': lazy(() => import('./pages/CommunityPage')),
  '/c': lazy(() => import('./pages/ChannelPage')),
  '/u': lazy(() => import('./pages/ProfilePage')),
};
const ProfilePage = lazy(() => import('./pages/ArchiveProfilePage'));

export default function App() {
  // An edit link (/u/<id>#key=...) moves the profile into this browser before anything renders
  if (adoptFromLink(window.location.pathname, window.location.hash)) { window.location.replace(window.location.pathname); return null; }
  // The panel would sit over the TV player's controls
  const onTv = /^\/(tv|c\/[^/]+)$/.test(window.location.pathname.replace(/\/+$/, ''));
  return <><Routed />{!onTv && <SaveLinkPanel />}<StaleKeyNotice /></>;
}

function Routed() {
  const redirect = redirectFor(window.location.pathname, window.location.search);
  if (redirect) { window.location.replace(redirect); return null; }
  const list = parseSitePath(window.location.pathname);
  if (list?.type === 'list' || list?.type === 'profile') {
    const Page = list.type === 'list' ? PAGES['/details'] : ProfilePage;
    return <Suspense fallback={<div className="min-h-screen bg-ink" />}><Page user={list.user} id={list.id} /></Suspense>;
  }
  const match = pageFor(window.location.pathname, window.location.search, window.location.hash);
  const Page = match && PAGES[match.key];
  if (!Page) return <ArchiveMovieBrowser />;
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink" />}>
      <Page slug={match.slug} />
    </Suspense>
  );
}
