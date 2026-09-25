import React, { useState } from 'react';

// The project's email address, shown only when asked for. It is put together here, in the browser,
// and appears nowhere as one string (not in the HTML, not in the bundle), so the scrapers that
// harvest addresses from pages and scripts don't collect it.
const PARTS = ['hello', 'orphanedfilms', 'com'];

export default function ContactEmail({ className = 'underline text-bone hover:text-signal', subject }) {
  const [shown, setShown] = useState(false);
  if (!shown) {
    return <button type="button" className={className} data-track="show-email" onClick={() => setShown(true)}>Show the email address</button>;
  }
  const address = `${PARTS[0]}@${PARTS[1]}.${PARTS[2]}`;
  return <a className={className} href={`mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`}>{address}</a>;
}
