// How a sort option in the UI maps onto Archive.org and onto the order a batch is shown in.

// Options look like 'downloads', 'date desc', 'title asc', or 'tmdb_rating' (ours, not Archive's)
export function apiSort(option) {
  if (option === 'tmdb_rating') return { sortBy: 'downloads', sortOrder: 'desc' };
  const [sortBy, sortOrder = 'desc'] = option.split(' ');
  return { sortBy, sortOrder };
}

// Ratings arrive one film at a time, so a batch is ranked once, before it is shown: no card ever
// moves once it is on screen, and "Load more" adds its films below the ones already there.
// Most Popular leads with films that have a real poster; sorts with a visible order (title,
// date, rating) are left exactly as Archive.org returned them.
export async function orderBatch(movies, option, { byRating, withPosters }) {
  if (option === 'tmdb_rating') return byRating(movies);
  if (option === 'downloads') return withPosters(movies);
  return movies;
}
