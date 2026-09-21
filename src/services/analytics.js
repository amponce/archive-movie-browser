// Usage analytics, our own: events go to /api/event on this site, which keeps counts only.
// No cookies, no visitor identifiers, no third party. See api/_stats.js for exactly what is
// counted. A fork with no stats database connected simply gets a 503 that nobody sees.

const MAX_PROPERTIES = 2;
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

export function track(name, properties) {
  try {
    if (!import.meta.env?.PROD) return; // local development is not usage
    const body = JSON.stringify({ name, data: eventData(properties) });
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

export function startAnalytics() {
  track('Page view', { path: location.pathname, referrer: referrerHost(document.referrer, location.host) });
}
