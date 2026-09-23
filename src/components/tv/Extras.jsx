import React, { useState } from 'react';
import { shareUrl } from '../../services/myChannel';
import { track } from '../../services/analytics';

// Small pieces of the TV page that don't need the set's state

// Everyone who opens a channel's link lands on the same frame, so a link is a watch party
export function WatchTogether({ channel }) {
  const [copied, setCopied] = useState(false);
  const url = channel.id === 'mine' && channel.ids ? shareUrl(channel.ids, window.location.origin) : `${window.location.origin}/tv#${channel.id}`;
  const copy = () => { navigator.clipboard?.writeText(url); setCopied(true); track('TV', { action: 'watch together', channel: channel.id }); setTimeout(() => setCopied(false), 4000); };
  return (
    <button type="button" onClick={copy} className="btn-primary w-full">
      {copied ? 'Link copied. Whoever opens it is on this frame' : 'Watch together: copy link'}
    </button>
  );
}

// Someone followed "Start your own channel" and has nothing on it yet
export function EmptyChannel() {
  return (
    <section aria-labelledby="empty-channel" className="panel p-6 sm:p-8 flex flex-col gap-4 max-w-[720px]">
      <h2 id="empty-channel" className="display text-3xl">Channel 0 is yours</h2>
      <p className="text-muted leading-relaxed">Open any film and choose Add to my channel. Your films play in order, round the clock, and anyone you send the link to lands on the same frame as you.</p>
      <div className="flex flex-wrap gap-3">
        <a href="/lists" className="btn-primary">Pick from the lists</a>
        <a href="/browse" className="btn-ghost">Browse films</a>
      </div>
    </section>
  );
}
