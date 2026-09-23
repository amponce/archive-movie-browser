// Usage analytics, our own: events go to /api/event on this site, which keeps counts only.
// No cookies, no third party. Each browser tab gets a random visit id, forgotten when the tab
// closes; the server only counts distinct ids per funnel stage and stores none of them. See
// api/_stats.js for exactly what is counted. A fork with no stats database gets a 503 nobody sees.

const MAX_PROPERTIES = 4;
const MAX_LENGTH = 60;

// Flat, short, lowercase, and with anything that looks like an email address removed
export function eventData(properties = {}) {
  const entries = Object.entries(properties)
    .filter(([, value]) => value !== undefined && value !== null)
    .slice(0, MAX_PROPERTIES)
    .map(([key, value]) => [key, typeof value === 'string'
      ? (key === 'query' ? value.trim().toLowerCase() : value).replace(/\S+@\S+\.\S+/g, '[email]').slice(0, MAX_LENGTH)
      : value]);
  return Object.fromEntries(entries);
}

// One random id per browser tab (sessionStorage), so the funnel can tell ten visits from one busy one
let memoryVisit = null;
export function visitId() {
  const make = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
  try {
    let id = sessionStorage.getItem('visit');
    if (!id) { id = make(); sessionStorage.setItem('visit', id); }
    return id;
  } catch {
    return (memoryVisit ||= make());
  }
}

export function track(name, properties) {
  try {
    if (!import.meta.env?.PROD) return; // local development is not usage
    const body = JSON.stringify({ name, data: eventData(properties), visit: visitId() });
    // sendBeacon survives the page closing (the last thing someone does is often the event)
    if (!navigator.sendBeacon?.('/api/event', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/event', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    }
  } catch { /* analytics must never break the app */ }
}

// Where someone came from, as a host name only ("news.ycombinator.com"), never a full address
export function referrerHost(referrer, ownHost) {
  try {
    const host = new URL(referrer).host.replace(/^www\./, '');
    return host && host !== ownHost ? host : '';
  } catch {
    return '';
  }
}

// A viewing's actual playback time: add() the seconds as they play, flush() at every pause and
// when the page goes away. Each report carries the seconds since the last one and the running total.
export function watchReporter(where, subject, send = track) {
  let total = 0;
  let pending = 0;
  return {
    add(seconds) { total += seconds; pending += seconds; },
    flush() {
      const seconds = Math.round(pending);
      if (seconds < 5) return; // a stray second of scrubbing is not watching
      pending -= seconds;
      send('Watched', { where, ...subject, seconds, total: Math.round(total) });
    },
  };
}

export function startAnalytics() {
  track('Page view', { path: location.pathname, referrer: referrerHost(document.referrer, location.host) });
  // Anything with data-track="name" (and optionally data-film) counts its clicks
  document.addEventListener('click', (event) => {
    const el = event.target.closest?.('[data-track]');
    if (el) track('Click', { target: el.dataset.track, film: el.dataset.film });
  }, { capture: true, passive: true });
}
