export function cleanMovieTitle(title) {
  return title
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/\s*\[\d{4}\]\s*$/, '')
    .replace(/\s*-\s*\d{4}\s*$/, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function selectMovieMatch(results, title, year = null) {
  if (!results?.length) return null;
  const searchTitle = cleanMovieTitle(title).toLowerCase();
  const candidates = results.map(movie => ({
    movie, title: cleanMovieTitle(movie.title || '').toLowerCase(),
  }));
  const preferYear = matches =>
    (year && matches.find(({ movie }) => movie.release_date?.slice(0, 4) === String(year)))
    || matches[0];
  const exact = searchTitle && preferYear(candidates.filter(candidate => candidate.title === searchTitle));
  if (exact) return exact.movie;

  const close = searchTitle && preferYear(candidates.filter(candidate => {
    const [shorter, longer] = [searchTitle, candidate.title].sort((a, b) => a.length - b.length);
    // A short word inside an unrelated title is not a useful match. Require
    // whole words and at least three quarters of the longer title.
    return shorter.length >= 4 && shorter.length / longer.length >= 0.75
      && ` ${longer} `.includes(` ${shorter} `);
  }));
  return close?.movie || (results[0].poster_path ? results[0] : null);
}
