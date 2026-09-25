import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFilters, filtersToQuery, URL_FILTER_DEFAULTS, RUNTIME_OPTIONS } from './urlFilters.js';

test('parseFilters and filtersToQuery round-trip a full set of filters', () => {
  const filters = {
    collection: 'silent_films',
    genre: 'Horror',
    q: 'nosferatu',
    sort: 'date desc',
    decade: 1920,
    runtime: 60,
    type: 'features',
  };
  const query = filtersToQuery(filters);
  assert.equal(query, 'collection=silent_films&genre=Horror&q=nosferatu&decade=1920&sort=date+desc&runtime=60');
  assert.deepEqual(parseFilters(`?${query}`), filters);
  assert.equal(filtersToQuery(parseFilters(`?${query}`)), query);
});

test('filtersToQuery omits defaults so the plain URL stays clean', () => {
  assert.equal(filtersToQuery(URL_FILTER_DEFAULTS), '');
  assert.equal(filtersToQuery({
    collection: 'all',
    genre: 'Horror',
    q: '',
    sort: 'downloads',
    decade: null,
    runtime: 40,
    type: 'features',
  }), '');
  assert.deepEqual(parseFilters(''), URL_FILTER_DEFAULTS);
  assert.deepEqual(parseFilters('?'), URL_FILTER_DEFAULTS);
});

test('bogus query values fall back to defaults', () => {
  assert.deepEqual(parseFilters('?sort=bogus&genre=Nope&runtime=abc'), URL_FILTER_DEFAULTS);
});

test('runtime values snap to an option the filter can display', () => {
  assert.equal(parseFilters('?runtime=299').runtime, RUNTIME_OPTIONS.at(-1));
  assert.equal(parseFilters('?runtime=74').runtime, 75);
});

test('Silent Films plus a 40 minute runtime survives the round trip', () => {
  const filters = parseFilters('?collection=silent_films&runtime=40');
  assert.equal(filters.collection, 'silent_films');
  assert.equal(filters.runtime, 40);
  const query = filtersToQuery(filters);
  assert.match(query, /collection=silent_films/);
  assert.match(query, /runtime=40/);
  assert.deepEqual(parseFilters(`?${query}`), filters);
});

test('type=trailers defaults runtime to 0', () => {
  const filters = parseFilters('?type=trailers');
  assert.equal(filters.type, 'trailers');
  assert.equal(filters.runtime, 0);
  assert.equal(filtersToQuery(filters), 'type=trailers');
});

test('a decade survives the round trip, and a junk one is ignored', () => {
  assert.equal(parseFilters('?decade=1980').decade, 1980);
  assert.equal(filtersToQuery(parseFilters('?decade=1980')), 'decade=1980');
  assert.equal(parseFilters('?decade=1985').decade, null);
  assert.equal(parseFilters('?decade=abc').decade, null);
});

test('All Films is the default, so it stays out of the URL; a named collection is written', () => {
  assert.equal(parseFilters('').collection, 'all');
  assert.equal(filtersToQuery({ collection: 'all', genre: 'Comedy' }), 'genre=Comedy');
  assert.equal(filtersToQuery({ collection: 'feature_films' }), 'collection=feature_films');
  assert.equal(parseFilters('?collection=feature_films').collection, 'feature_films');
  // Anything shaped like an identifier is a collection someone may have linked to; junk is not
  assert.equal(parseFilters('?collection=nonsense').collection, 'nonsense');
  assert.equal(parseFilters('?collection=%3Cjunk%3E').collection, 'all');
});

test('an old link to a genre-named collection opens All Films with that genre selected', () => {
  assert.deepEqual([parseFilters('?collection=SciFi_Horror&genre=all').collection, parseFilters('?collection=SciFi_Horror&genre=all').genre], ['SciFi_Horror', 'all'], 'a mixed collection opens as itself');
  assert.deepEqual([parseFilters('?collection=Film_Noir&decade=1940').collection, parseFilters('?collection=Film_Noir&decade=1940').genre], ['all', 'Film Noir']);
  assert.equal(parseFilters('?collection=SciFi_Horror&genre=Comedy').genre, 'Comedy', 'an explicit genre wins');
  assert.equal(filtersToQuery(parseFilters('?collection=SciFi_Horror&genre=all')), 'collection=SciFi_Horror&genre=all');
  assert.equal(filtersToQuery(parseFilters('?collection=Film_Noir')), 'genre=Film+Noir');
});

test('the site lands on Horror in All Films (the best covers), and All Genres is one explicit click away', () => {
  assert.equal(parseFilters('').genre, 'Horror');
  assert.equal(filtersToQuery({ genre: 'Horror' }), '', 'the landing view keeps a clean URL');
  // All Genres has to be written down, or a reload would land back on Horror
  assert.equal(filtersToQuery({ genre: 'all' }), 'genre=all');
  assert.equal(parseFilters('?genre=all').genre, 'all');
  // A search looks across every genre unless one is chosen, and its URL stays short
  assert.equal(parseFilters('?q=keaton').genre, 'all');
  assert.equal(filtersToQuery({ q: 'keaton', genre: 'all' }), 'q=keaton');
  assert.equal(filtersToQuery({ q: 'keaton', genre: 'Horror' }), 'genre=Horror&q=keaton');
});

test('a collection the app does not list is still accepted when it looks like an identifier', async () => {
  const { parseFilters } = await import('./urlFilters.js');
  assert.equal(parseFilters('?collection=prelinger_home_movies').collection, 'prelinger_home_movies');
  assert.equal(parseFilters('?collection=movies').collection, 'movies');
  assert.equal(parseFilters('?collection=bad%20id%3Cscript%3E').collection, 'all');
});

test('a search in the address is cut to what the search box takes', () => {
  assert.equal(parseFilters(`?q=${'a'.repeat(5000)}`).q.length, 200);
});
