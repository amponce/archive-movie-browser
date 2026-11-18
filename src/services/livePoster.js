import { indexedMatch } from './posterIndex.js';
import archiveService from './archive.js';
import tmdbService from './tmdb.js';

// A saved film's card is drawn from the poster index alone, and a film the index has not decided
// came out with no poster and its identifier for a title, while its own page showed both. This
// asks what the film page asks (the upload's record, then the match for its title and year).
// A film the index decided has no poster still gets its title: searchMovie answers that one
// from the index, with no lookup. The same card back means there is nothing to add.
export async function livePoster(card) {
  if (card.poster || (await indexedMatch(card.id))) return card;
  try {
    const movie = await archiveService.getMovieByIdentifier(card.id);
    const match = await tmdbService.searchMovie(movie.title, movie.year, card.id);
    return { ...card, title: movie.title, year: movie.year || card.year, poster: tmdbService.getPosterUrl(match?.posterPath, 'medium') };
  } catch {
    return card;
  }
}
