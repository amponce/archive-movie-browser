import { ALL_FILMS, collectionName } from './archive.js';
import { LANDING_GENRE } from './urlFilters.js';

export const SITE_TITLE = 'Orphaned Films: forgotten films, found';

// The browser tab's title for the browse page: the open film, else the active search, genre and
// collection. The landing view (Horror in All Films) keeps the site title.
export function pageTitle({ movie, search, genre, collection } = {}) {
  if (movie?.title) {
    const title = String(movie.title);
    return `${movie.year && !title.includes(`(${movie.year})`) ? `${title} (${movie.year})` : title} | Orphaned Films`;
  }
  const inAll = !collection || collection === ALL_FILMS;
  const parts = [
    search && `"${search}"`,
    genre && genre !== 'all' && !(inAll && !search && genre === LANDING_GENRE) && genre,
    !inAll && collectionName(collection),
  ].filter(Boolean);
  return parts.length ? `${parts.join(' · ')} | Orphaned Films` : SITE_TITLE;
}
