import React from 'react';

const REPO = 'https://github.com/amponce/archive-movie-browser';

// The same footer on every page: the one-line promise, the links, and the disclaimer that keeps
// us honest about who hosts what.
// `counts` (from the poster index) adds one quiet line for people who want to help.
export default function SiteFooter({ children, counts }) {
  const ext = { target: '_blank', rel: 'noopener noreferrer', className: 'underline hover:text-bone' };
  return (
    <footer className="gutter py-8 border-t border-line flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-mono text-[11px] tracking-[0.06em] text-dim">Every film here is hosted by the Internet Archive. We index, you watch there or here. Nothing is ours.</span>
        <span className="flex flex-wrap gap-6">
          {children}
          <a href="/lists" className="label hover:text-bone inline-flex items-center min-h-[44px]">Lists</a>
          <a href="/mcp" className="label hover:text-bone inline-flex items-center min-h-[44px]">MCP server</a>
          <a href={REPO} className="label hover:text-bone inline-flex items-center gap-2 min-h-[44px]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" /></svg>
            Contribute on GitHub
          </a>
          <a href="https://archive.org/details/movies" className="label hover:text-bone inline-flex items-center min-h-[44px]">Archive.org</a>
        </span>
      </div>
      {counts && (
        <p className="font-mono text-[11px] tracking-[0.06em] text-dim">
          {counts.identified.toLocaleString('en-US')} films identified so far, {counts.wanted.toLocaleString('en-US')} still without a poster.{' '}
          <a href={`${REPO}#how-films-get-identified`} className="underline hover:text-bone">Know one? Help fix it.</a>
        </p>
      )}
      <p className="max-w-3xl text-xs leading-relaxed text-dim">
        This is an independent, open-source viewer. It hosts no video: every film is stored and streamed by the{' '}
        <a href="https://archive.org" {...ext}>Internet Archive</a>{' '}
        and appears here as its uploader published it there. We are not affiliated with or endorsed by the Internet Archive.
        To have a film removed, see <a href="/takedown" className="underline hover:text-bone">removing a film</a>: from archive.org
        itself under the Internet Archive's{' '}
        <a href="https://archive.org/about/terms.php" {...ext}>terms of use and copyright policy</a>, or from this site on request. Posters and film details come from{' '}
        <a href="https://www.themoviedb.org" {...ext}>TMDB</a>.
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </footer>
  );
}
