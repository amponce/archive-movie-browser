import React from 'react';

const REPO = 'https://github.com/amponce/archive-movie-browser';

// The same footer on every page: the one-line promise, the links, and the disclaimer that keeps
// us honest about who hosts what.
export default function SiteFooter({ children }) {
  const ext = { target: '_blank', rel: 'noopener noreferrer', className: 'underline hover:text-bone' };
  return (
    <footer className="gutter py-8 border-t border-line flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="font-mono text-[11px] tracking-[0.06em] text-dim">Every film here is hosted by the Internet Archive. We index, you watch there or here. Nothing is ours.</span>
        <span className="flex flex-wrap gap-6">
          {children}
          <a href="/lists" className="label hover:text-bone">Runs</a>
          <a href="/mcp" className="label hover:text-bone">MCP server</a>
          <a href={REPO} className="label hover:text-bone">GitHub</a>
          <a href="https://archive.org/details/movies" className="label hover:text-bone">Archive.org</a>
        </span>
      </div>
      <p className="max-w-3xl text-xs leading-relaxed text-dim">
        This is an independent, open-source viewer. It hosts no video: every film is stored and streamed by the{' '}
        <a href="https://archive.org" {...ext}>Internet Archive</a>{' '}
        and appears here as its uploader published it there. We are not affiliated with or endorsed by the Internet Archive.
        For rights questions or to have a film removed, contact the Internet Archive under its{' '}
        <a href="https://archive.org/about/terms.php" {...ext}>terms of use and copyright policy</a>;
        once it is gone there, it is gone here. Posters and film details come from{' '}
        <a href="https://www.themoviedb.org" {...ext}>TMDB</a>.
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </footer>
  );
}
