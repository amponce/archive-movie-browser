import React, { useEffect } from 'react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import { TAKEN_DOWN } from '../services/policy';

const REQUEST = 'https://github.com/amponce/archive-movie-browser/issues/new?template=removal_request.md&labels=removal&title=Removal+request';
const ARCHIVE_POLICY = 'https://archive.org/about/terms.php';
// Filled in once the DMCA designated agent is registered with the US Copyright Office
const AGENT = null; // { name, email, address }

// /takedown: how to have a film removed, and what happens when you ask
export default function TakedownPage() {
  useEffect(() => { document.title = 'Removing a film | Orphaned Films'; }, []);
  const removed = TAKEN_DOWN.filter(t => !t.reason.startsWith('test fixture')).length;
  const ext = { target: '_blank', rel: 'noopener noreferrer', className: 'underline text-bone hover:text-signal' };
  return (
    <div className="min-h-screen">
      <SiteHeader current="/takedown" />
      <main className="gutter py-12 flex flex-col gap-8 max-w-[72ch]">
        <h1 className="display text-4xl sm:text-5xl">Removing a film</h1>
        <p className="text-lg text-muted leading-relaxed">
          Orphaned Films is an independent viewer for the Internet Archive. It hosts no video: every film is stored and
          streamed by archive.org, as its uploader published it there. We match uploads to the films they are and
          organise them into lists and channels.
        </p>

        <section className="flex flex-col gap-3">
          <h2 className="display text-2xl">To remove the file itself</h2>
          <p className="text-muted leading-relaxed">
            Send your notice to the Internet Archive under its <a href={ARCHIVE_POLICY} {...ext}>terms of use and copyright policy</a>.
            Once a file is gone from archive.org it can no longer play here, and it drops off our pages.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="display text-2xl">To remove it from this site</h2>
          <p className="text-muted leading-relaxed">
            <a href={REQUEST} {...ext}>Open a removal request</a> with the archive.org address of each upload, who you are
            or whom you represent, and why. We take it off every part of this site, including search, film pages,
            channels, lists and our MCP server, usually within two days, and tell you when it's done. The request form is public.
          </p>
          {AGENT && (
            <p className="text-muted leading-relaxed">
              Formal notices under the DMCA can also go to our designated agent: {AGENT.name}, <a href={`mailto:${AGENT.email}`} {...ext}>{AGENT.email}</a>, {AGENT.address}.
            </p>
          )}
        </section>

        <p className="text-sm text-dim">
          {removed ? `${removed} upload${removed === 1 ? '' : 's'} removed from this site on request so far.` : 'No removal requests so far.'}
          {' '}Films from the last 25 years are never put on the front page, channels or lists by the site itself.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
