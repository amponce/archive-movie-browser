// Usage analytics: Vercel Web Analytics. Cookieless, no user identifiers, nothing sold or shared;
// it counts page views and the handful of events below so we can see whether people find and
// watch films. Does nothing until Web Analytics is enabled for the Vercel project, and in
// development it only logs to the console.
import { inject, track as send } from '@vercel/analytics';

const MAX_PROPERTIES = 2; // what the plan accepts per event
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

export function startAnalytics() {
  inject();
}

export function track(name, properties) {
  try {
    send(name, eventData(properties));
  } catch { /* analytics must never break the app */ }
}
