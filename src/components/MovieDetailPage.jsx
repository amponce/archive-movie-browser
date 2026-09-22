import React from 'react';
import { useParams } from 'react-router-dom';
import usePosterIndex from '../hooks/usePosterIndex';
import useRelated from '../hooks/useRelated';
import TitleCover from './TitleCover';
import FilmPlayer from './FilmPlayer';
import './MovieDetailPage.css'; // ensure styles are scoped (optional)

/**
 * MovieDetailPage shows the details of a single film.
 * It receives the film identifier from the URL, loads the poster
 * (and other metadata) via `usePosterIndex`, and renders the player.
 *
 * New feature: when the poster was taken from the poster‑index
 * (`match.fromIndex === true`) we display a small “Wrong poster?” link.
 * Clicking the link opens a pre‑filled GitHub issue so viewers can
 * suggest a correction without any backend involvement.
 */
export default function MovieDetailPage() {
  const { identifier } = useParams(); // e.g. archive.org identifier
  const { match, loading, error } = usePosterIndex(identifier);
  const { related } = useRelated(identifier);

  if (loading) return <div className="loading">Loading…</div>;
  if (error) return <div className="error">Error loading poster.</div>;

  // Guard against missing match (should not happen, but be safe)
  if (!match) return <div className="no-data">No data found.</div>;

  // Build the GitHub issue URL when the poster came from the index
  const githubIssueUrl = React.useMemo(() => {
    if (!match.fromIndex) return null;

    const title = `Wrong poster for ${match.title || identifier}`;
    const bodyLines = [
      '**Archive.org Identifier**',
      match.identifier || identifier,
      '',
      '**Upload Title**',
      match.uploadTitle || '(unknown)',
      '',
      '**Suggested Film**',
      match.filmTitle || '(unknown)',
      '',
      'Please let us know the correct poster or any other details that could help fix this entry.',
    ];
    const body = bodyLines.join('\n');
    const url = new URL(
      'https://github.com/amponce/archive-movie-browser/issues/new'
    );
    url.searchParams.set('title', title);
    url.searchParams.set('body', body);
    url.searchParams.set('labels', 'data');
    return url.toString();
  }, [match, identifier]);

  return (
    <div className="movie-detail-page">
      <TitleCover match={match} />
      <section className="movie-meta">
        <h1>{match.title ?? 'Untitled'}</h1>

        {/* ---- NEW “Wrong poster?” LINK ---- */}
        {githubIssueUrl && (
          <a
            href={githubIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="wrong-poster-link"
            style={{
              fontSize: '0.9rem',
              marginLeft: '0.5rem',
              color: '#0066cc',
            }}
          >
            Wrong poster?
          </a>
        )}
        {/* --------------------------------- */}

        {/* other metadata such as year, rating, etc. */}
        {/* ... existing component code ... */}
      </section>

      <FilmPlayer match={match} />

      {/* Related movies, etc. */}
      {/* ... existing component code ... */}
    </div>
  );
}
