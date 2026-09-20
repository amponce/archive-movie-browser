import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMovieTitle, selectMovieMatch, titleCandidates, filmYearFromTitle, bestStrictMatch } from './movieMatching.js';

const movie = (id, title, year = '1959') => ({ id, title, release_date: `${year}-01-01`, poster_path: `/${id}.jpg` });

test('title cleaning retains the search service year and punctuation normalization', () => {
  for (const title of ['The Last Man (1964)', 'The Last Man [1964]', 'The Last Man - 1964']) {
    assert.equal(cleanMovieTitle(title), 'The Last Man');
  }
  assert.equal(cleanMovieTitle('  House:  on Haunted Hill! '), 'House on Haunted Hill');
});

test('exact cleaned titles outrank earlier partial matches and prefer the known year', () => {
  const results = [movie(1, 'The Last'), movie(2, 'The Last Man', '1964'), movie(3, 'THE LAST MAN!', '1990')];
  assert.equal(selectMovieMatch(results, 'The Last Man (1990)', 1990).id, 3);
  assert.equal(selectMovieMatch(results, 'The Last Man', 2000).id, 3); // closest year, not just an equal one
  assert.equal(selectMovieMatch(results, 'The Last Man').id, 2);
});

for (const title of ['M', 'The', 'It']) {
  test(`the short title ${title} is not matched by substring alone`, () => {
    const results = [movie(1, 'A Different Film'), movie(2, title)];
    assert.equal(selectMovieMatch(results, 'The City of Missing Men'), null);
    assert.equal(selectMovieMatch(results, title).id, 2);
  });
}

test('close matches must be whole words and a meaningful share of the title', () => {
  const fallback = movie(1, 'A Different Film');
  assert.equal(selectMovieMatch([fallback, movie(2, 'House on Haunted Hill')], 'The House on Haunted Hill').id, 2);
  assert.equal(selectMovieMatch([fallback, movie(2, 'The House on Haunted Hill')], 'House on Haunted Hill').id, 2);
  assert.equal(selectMovieMatch([fallback, movie(2, 'House')], 'House on Haunted Hill'), null);
  assert.equal(selectMovieMatch([fallback, movie(2, 'Alien')], 'Aliens'), null);
});

test('fallback requires a poster and empty results return null', () => {
  assert.equal(selectMovieMatch([], 'Example'), null);
  assert.equal(selectMovieMatch(undefined, 'Example'), null);
  assert.equal(selectMovieMatch([{ title: 'Other' }], 'Example'), null);
  assert.equal(selectMovieMatch([movie(1, 'Other')], 'Example'), null); // an unrelated first result is not a match
  assert.equal(selectMovieMatch([movie(1, 'Example Film')], 'Example').id, 1);
  assert.equal(selectMovieMatch([movie(1, 'Other'), { id: 2, title: 'Example' }], 'Example').id, 2);
});

// Real Archive.org titles that found no poster, or the wrong one. Years are not sent to TMDB
// (Archive.org years are often the upload year); selection prefers the closest year instead.
const queries = title => titleCandidates(title).map(c => `${c.query}${c.strict ? ' (strict)' : ''}`);

test('titleCandidates strips upload noise, underscores, years and subtitle notes', () => {
  assert.deepEqual(queries('Nosferatu_DVD_quality'), ['Nosferatu']);
  assert.deepEqual(queries('Driller Killer-Uncut'), ['Driller Killer']);
  assert.deepEqual(queries('Nekromantik(1987) ENGLISH HARD SUB'), ['Nekromantik']);
  assert.deepEqual(queries('Nosferatu A Symphony Of Horror 1922'), ['Nosferatu A Symphony Of Horror']);
  assert.deepEqual(queries("Rogue's Tavern"), ["Rogue's Tavern"]);
  assert.deepEqual(queries('1984'), ['1984']);
});

test('titleCandidates tries alternate titles, AKA names and the parts around a separator as strict guesses', () => {
  assert.deepEqual(queries('Das Kabinett des Doktor Caligari ( The Cabinet of Dr. Caligari )'),
    ['Das Kabinett des Doktor Caligari', 'The Cabinet of Dr Caligari (strict)']);
  assert.deepEqual(queries('The Mysterious Rider AKA Mark of the Avenger'),
    ['The Mysterious Rider AKA Mark of the Avenger', 'The Mysterious Rider (strict)', 'Mark of the Avenger (strict)']);
  assert.deepEqual(queries('Silent Horror Film: Nosferatu'), ['Silent Horror Film Nosferatu', 'Silent Horror Film (strict)', 'Nosferatu (strict)']);
  assert.deepEqual(queries('Fright Night: House on Haunted Hill'), ['Fright Night House on Haunted Hill', 'Fright Night (strict)', 'House on Haunted Hill (strict)']);
});

test('titleCandidates ignores generic one-word notes and never returns more than four queries', () => {
  assert.deepEqual(queries('Return To House On Haunted Hill - Lesbian Ghosts scene (Unrated)'),
    ['Return To House On Haunted Hill Lesbian Ghosts scene', 'Return To House On Haunted Hill (strict)', 'Lesbian Ghosts scene (strict)']);
  assert.deepEqual(queries('House on Haunted Hill [1959] - Trailer'), ['House on Haunted Hill Trailer', 'House on Haunted Hill (strict)']);
  assert.deepEqual(queries('Phantom Ship , The'), ['The Phantom Ship']);
  assert.ok(titleCandidates('A Film - B Film - C Film - D Film - E Film').length <= 4);
});

test('filmYearFromTitle reads a year written in the title', () => {
  assert.equal(filmYearFromTitle('House on Haunted Hill (1999)'), 1999);
  assert.equal(filmYearFromTitle('Nosferatu A Symphony Of Horror 1922'), 1922);
  assert.equal(filmYearFromTitle('In The Year 2889'), null);
  assert.equal(filmYearFromTitle('1984'), null);
});

test('same-titled films: the closest year wins, and the oldest when the year is unknown', () => {
  const results = [movie(1, 'The Fast and the Furious', '2001'), movie(2, 'The Fast and the Furious', '1954')];
  assert.equal(selectMovieMatch(results, 'The Fast And The Furious', 1955).id, 2);
  assert.equal(selectMovieMatch(results, 'The Fast And The Furious', 2002).id, 1);
  const nosferatu = [movie(1, 'Nosferatu', '2024'), movie(2, 'Nosferatu', '1922'), movie(3, 'Nosferatu', '1979')];
  assert.equal(selectMovieMatch(nosferatu, 'Nosferatu').id, 2);
});

test('the first-result fallback needs shared words; strict guesses get no fallback at all', () => {
  assert.equal(selectMovieMatch([movie(1, 'The Pawnshop')], "Charlie Chaplin's The Pawnshop").id, 1);
  assert.equal(selectMovieMatch([movie(1, 'Bornless Ones')], 'The House On Haunted Hill'), null);
  assert.equal(selectMovieMatch([movie(1, 'MM 51 Nosferatu')], 'Nosferatu silent F W Murnau'), null);
  assert.equal(selectMovieMatch([movie(1, 'The Pawnshop')], "Charlie Chaplin's The Pawnshop", null, { strict: true }), null);
});

test('bestStrictMatch weighs every part of a split title instead of taking the first that matches', () => {
  const frightNight = movie(1, 'Fright Night', '2016'), house = movie(2, 'House on Haunted Hill', '1959');
  assert.equal(bestStrictMatch([frightNight, house], null).id, 2);
  assert.equal(bestStrictMatch([frightNight, house], 2016).id, 1);
  assert.equal(bestStrictMatch([], 1959), null);
});

test('a match released after the year the upload claims is rejected, not shown as a wrong poster', () => {
  const remake = [movie(1, 'Nosferatu: A Symphony of Horror', '2023')];
  assert.equal(selectMovieMatch(remake, 'Nosferatu A Symphony Of Horror', 1922), null);
  assert.equal(selectMovieMatch(remake, 'Nosferatu A Symphony Of Horror', 2023).id, 1);
  assert.equal(selectMovieMatch(remake, 'Nosferatu A Symphony Of Horror').id, 1);
  assert.equal(selectMovieMatch([movie(1, 'Silent Movie', '1976')], 'Silent Movie', 1922, { strict: true }), null);
  // Archive.org years run late (re-release, VHS date), so an older film is still accepted
  assert.equal(selectMovieMatch([movie(1, 'Nosferatu', '1922')], 'Nosferatu', 1929).id, 1);
  assert.equal(bestStrictMatch([movie(1, 'Fright Night', '2016'), movie(2, 'House on Haunted Hill', '1959')], 1960).id, 2);
});
