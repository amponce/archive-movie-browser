// Page view for the static pages (the app reports its own). Counts only: see api/_stats.js.
(function () {
  var host = '';
  try { host = new URL(document.referrer).host.replace(/^www\./, ''); } catch (e) { /* no referrer */ }
  var body = JSON.stringify({ name: 'Page view', data: { path: location.pathname, referrer: host === location.host ? '' : host } });
  if (!(navigator.sendBeacon && navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' })))) {
    fetch('/api/event', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(function () {});
  }
})();
