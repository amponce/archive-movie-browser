import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { startAnalytics } from './services/analytics';

startAnalytics();

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
  </React.StrictMode>
);
