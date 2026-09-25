import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './fonts.css';
import './index.css';
import { Analytics } from '@vercel/analytics/react';
import { startAnalytics } from './services/analytics';

startAnalytics();

// Each page is its own canonical address on the site's domain (index.html carries the home page's),
// so /lists/... and /browse are indexed as themselves, never as a preview or vercel.app copy
const canonical = `https://www.orphanedfilms.com${location.pathname}`;
document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical);

// One film with sound at a time: when a video starts, any other one playing with sound pauses
// (the TV set, a channel opened in the guide, a film). The muted front-page preview is left alone.
document.addEventListener('play', (event) => {
  if (!(event.target instanceof HTMLVideoElement) || event.target.muted) return;
  for (const other of document.querySelectorAll('video')) if (other !== event.target && !other.muted && !other.paused) other.pause();
}, true);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    {/* Vercel Web Analytics: page views and visitors, cookieless, beside our own counts (api/_stats.js).
        The address goes without its query and hash: those carry search text (?q=) and films (#id). */}
    <Analytics beforeSend={event => ({ ...event, url: event.url.split(/[?#]/)[0] })} />
  </React.StrictMode>
);
