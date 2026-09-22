import test from 'node:test';
import assert from 'node:assert/strict';
import archiveService from './archive.js';

test('getMovieByIdentifier normalizes Archive.org metadata', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      metadata: {
        identifier: 'example-film',
        title: ['Example Film'],
        year: '1954',
        runtime: '1:30:00',
        subject: ['science fiction', 'Drama'],
        downloads: 42,
        description: 'A test movie.',
        creator: ['Test Director'],
        date: '1954-01-01'
      }
    })
  });
  try {
    const movie = await archiveService.getMovieByIdentifier('example-film');
    assert.deepEqual(movie, {
      id: 'example-film', identifier: 'example-film', title: 'Example Film',
      year: 1954, runtimeMinutes: 90, runtime: '1:30:00', genres: ['Drama', 'Sci-Fi'], tags: ['science fiction', 'Drama'],
      downloads: 42, sizeMB: null, rating: null, description: 'A test movie.', creator: 'Test Director',
      archiveUrl: 'https://archive.org/details/example-film',
      thumbnailUrl: 'https://archive.org/services/img/example-film',
      embedUrl: 'https://archive.org/embed/example-film', date: '1954-01-01', publicDate: undefined
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('getMovieByIdentifier uses the identifier when metadata has no title', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ metadata: { identifier: 'untitled-item' } })
  });
  try {
    const movie = await archiveService.getMovieByIdentifier('untitled-item');
    assert.equal(movie.identifier, 'untitled-item');
    assert.equal(movie.title, 'untitled-item');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('getMovieByIdentifier throws when metadata response is empty or missing metadata', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
  try {
    await assert.rejects(
      () => archiveService.getMovieByIdentifier('missing-item'),
      /Archive\.org item not found: missing-item/
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('getMovieByIdentifier throws when metadata has no identifier', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ metadata: {} }) });
  try {
    await assert.rejects(
      () => archiveService.getMovieByIdentifier('no-identifier-item'),
      /Archive\.org item not found: no-identifier-item/
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('getMovieByIdentifier rejects when item contains blocked identifier', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      metadata: {
        identifier: 'thechild-item',
        title: 'Some Film'
      }
    })
  });
  try {
    await assert.rejects(
      () => archiveService.getMovieByIdentifier('thechild-item'),
      /Archive\.org item is blocked: thechild-item/
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('getMovieByIdentifier rejects when item contains blocked title', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      metadata: {
        identifier: 'innocent-identifier',
        title: 'The Child Film'
      }
    })
  });
  try {
    await assert.rejects(
      () => archiveService.getMovieByIdentifier('innocent-identifier'),
      /Archive\.org item is blocked: innocent-identifier/
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

const allowedContent = [
  { identifier: 'thechildrenshour', title: "The Children's Hour" },
  { identifier: 'thechildhoodofmaximgorky', title: ['The Childhood of Maxim Gorky'] },
];
const blockedContent = [
  { identifier: 'blocked-title', title: 'The Child Film' },
  { identifier: 'blocked-array-title', title: ['THE CHILD (1977)'] },
  { identifier: 'thechild-item', title: 'Some Film' },
  { identifier: 'TheChild1977', title: 'Another Film' },
  { identifier: 'classic_thechild_1977', title: 'A Third Film' },
];

test('fetchMovies keeps longer words while filtering blocked titles and identifier tokens', async () => {
  const realFetch = globalThis.fetch;
  const docs = [...blockedContent, ...allowedContent];
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ response: { docs, numFound: docs.length } })
  });
  try {
    const { movies } = await archiveService.fetchMovies({});
    assert.deepEqual(movies.map(movie => movie.identifier), allowedContent.map(movie => movie.identifier));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('getMovieByIdentifier keeps longer words while rejecting blocked titles and identifier tokens', async () => {
  const realFetch = globalThis.fetch;
  try {
    for (const metadata of blockedContent) {
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ metadata }) });
      await assert.rejects(
        () => archiveService.getMovieByIdentifier(metadata.identifier),
        { message: `Archive.org item is blocked: ${metadata.identifier}` }
      );
    }
    for (const metadata of allowedContent) {
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ metadata }) });
      const movie = await archiveService.getMovieByIdentifier(metadata.identifier);
      assert.equal(movie.identifier, metadata.identifier);
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('parseRuntime reads two-part values as MM:SS', () => {
  assert.equal(Math.round(archiveService.parseRuntime('20:33')), 21);
  assert.equal(Math.round(archiveService.parseRuntime('51:56')), 52);
  assert.equal(Math.round(archiveService.parseRuntime('08:30')), 9);
});

test('parseRuntime keeps the formats that already worked', () => {
  assert.equal(Math.round(archiveService.parseRuntime('1:17:26')), 77);
  assert.equal(archiveService.parseRuntime('108 min'), 108);
  assert.equal(archiveService.parseRuntime('71min'), 71);
  assert.equal(archiveService.parseRuntime(undefined), 0);
});

test('buildQuery matches all search words and drops query syntax characters', () => {
  const query = archiveService.buildQuery({ searchQuery: 'the "thing" \\ (1951)', collection: 'SciFi_Horror' });
  assert.ok(query.includes('title:(the AND thing AND 1951)'), query);
  assert.ok(!/["\\]/.test(query.replace('collection:"SciFi_Horror"', '')), query);
});

test('buildQuery ignores a search made only of punctuation', () => {
  assert.equal(archiveService.buildQuery({ searchQuery: '"" ()', collection: 'SciFi_Horror' }), 'collection:"SciFi_Horror" AND NOT mediatype:collection');
});

test('fetchMovies throws when Archive.org returns an error body with HTTP 200', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ error: 'a quoted string is empty' }) });
  try {
    await assert.rejects(() => archiveService.fetchMovies({}), /quoted string is empty/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('buildQuery matches genre aliases, not just the display name', () => {
  const query = archiveService.buildQuery({ genre: 'Sci-Fi', collection: 'feature_films' });
  assert.ok(query.includes('"Sci-Fi"') && query.includes('"science fiction"'), query);
});

// Serves pages of 4 docs where only every 4th has a long runtime
function mockArchive(totalPages) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const page = Number(new URL(url).searchParams.get('page'));
    calls.push(page);
    const docs = page > totalPages ? [] : [0, 1, 2, 3].map(i => ({
      identifier: `p${page}-${i}`,
      title: `Movie ${page}-${i}`,
      runtime: i === 0 ? '1:30:00' : '5:00'
    }));
    return { ok: true, json: async () => ({ response: { docs, numFound: totalPages * 4 } }) };
  };
  return calls;
}

test('fetchFiltered keeps fetching pages until the batch is full', async () => {
  const realFetch = globalThis.fetch;
  const calls = mockArchive(10);
  try {
    const result = await archiveService.fetchFiltered({
      count: 3, rowsPerPage: 4, filter: m => m.runtimeMinutes >= 40
    });
    assert.equal(result.movies.length, 3);
    assert.deepEqual(calls, [1, 2, 3]);
    assert.equal(result.nextPage, 4);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchFiltered stops at the end of results and at the page cap', async () => {
  const realFetch = globalThis.fetch;
  try {
    mockArchive(2);
    const ended = await archiveService.fetchFiltered({ count: 10, rowsPerPage: 4, filter: m => m.runtimeMinutes >= 40 });
    assert.equal(ended.movies.length, 2);
    assert.equal(ended.nextPage, null);

    const calls = mockArchive(100);
    const capped = await archiveService.fetchFiltered({ count: 50, rowsPerPage: 4, maxPages: 3, filter: m => m.runtimeMinutes >= 40 });
    assert.deepEqual(calls, [1, 2, 3]);
    assert.equal(capped.nextPage, 4);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchFiltered skips films an earlier batch already returned', async () => {
  const realFetch = globalThis.fetch;
  mockArchive(5);
  try {
    const seenTitles = new Set();
    const options = { count: 1, rowsPerPage: 4, seenTitles, filter: m => m.runtimeMinutes >= 40 };
    const first = await archiveService.fetchFiltered(options);
    const again = await archiveService.fetchFiltered(options);
    assert.equal(first.movies[0].title, 'Movie 1-0');
    assert.equal(again.movies[0].title, 'Movie 2-0');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('buildQuery lowercases search words so AND/OR are not read as operators', () => {
  const query = archiveService.buildQuery({ searchQuery: 'AND OR', collection: 'SciFi_Horror' });
  assert.ok(query.includes('title:(and AND or)'), query);
});

test('buildQuery searches every app collection, but browses only the selected one', () => {
  const search = archiveService.buildQuery({ searchQuery: 'casablanca', collection: 'SciFi_Horror' });
  assert.ok(search.startsWith('collection:(feature_films OR '), search);
  assert.ok(search.includes(' OR Film_Noir OR ') && !search.includes('collection:"SciFi_Horror"'), search);

  assert.equal(archiveService.buildQuery({ collection: 'SciFi_Horror' }), 'collection:"SciFi_Horror" AND NOT mediatype:collection');
});

function mockDocs(docs) {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ response: { docs, numFound: docs.length } }) });
}

test('fetchFiltered treats a trailing year as the same title', async () => {
  const realFetch = globalThis.fetch;
  mockDocs([
    { identifier: 'a', title: 'House on Haunted Hill' },
    { identifier: 'b', title: 'House on Haunted Hill (1959)' },
    { identifier: 'c', title: 'HOUSE ON HAUNTED HILL [1959]' },
    { identifier: 'd', title: '1984' },
    { identifier: 'e', title: '2001' }
  ]);
  try {
    const result = await archiveService.fetchFiltered({});
    assert.deepEqual(result.movies.map(m => m.identifier), ['a', 'd', 'e']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchFiltered lists title matches before subject-only matches when searching by popularity', async () => {
  const realFetch = globalThis.fetch;
  mockDocs([
    { identifier: 'musicals', title: 'Old Time Musicals Part 8', subject: 'casablanca' },
    { identifier: 'film', title: 'Casablanca (1942)' },
    { identifier: 'eye', title: 'The Hypnotic Eye', subject: 'casablanca' },
    { identifier: 'express', title: 'Casablanca Express' }
  ]);
  try {
    const ranked = await archiveService.fetchFiltered({ searchQuery: 'Casablanca', sortBy: 'downloads' });
    assert.deepEqual(ranked.movies.map(m => m.identifier), ['film', 'express', 'musicals', 'eye']);

    const byDate = await archiveService.fetchFiltered({ searchQuery: 'Casablanca', sortBy: 'date' });
    assert.deepEqual(byDate.movies.map(m => m.identifier), ['musicals', 'film', 'eye', 'express']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('parseRuntime handles the odd separators Archive.org uploaders use', () => {
  const minutes = (runtime) => Math.round(archiveService.parseRuntime(runtime));
  assert.equal(minutes('1:33.13'), 93);
  assert.equal(minutes("01:10'31"), 71);
  assert.equal(minutes('00.59.56'), 60);
  assert.equal(minutes('00:52:20.10'), 52);
  assert.equal(minutes('1h 25m'), 85);
  assert.equal(minutes('2h'), 120);
  assert.equal(minutes('28 min 32 sec'), 29);
  assert.equal(minutes('10,26’'), 10);
  assert.equal(minutes('89 min.'), 89);
  assert.equal(minutes('73 Minutes'), 73);
  assert.equal(minutes('71'), 71);
  assert.equal(minutes('0:00'), 0);
  assert.equal(minutes('unknown'), 0);
});

test('betterCopy prefers quality signals, then item size', () => {
  const plain = { title: 'Night of the Living Dead', sizeMB: 900 };
  const restored = { title: 'Night of the Living Dead 1080p restored', sizeMB: 500 };
  assert.equal(archiveService.betterCopy(restored, plain), restored);
  const larger = { title: plain.title, sizeMB: 1200 };
  assert.equal(archiveService.betterCopy(larger, plain), larger);
});

test('fetchFiltered treats re-uploads with quality tags as the same film', async () => {
  const realFetch = globalThis.fetch;
  mockDocs([
    { identifier: 'keep-film', title: 'House on Haunted Hill', year: '1959' },
    { identifier: 'dupe-the', title: 'The House On Haunted Hill', year: '1959' },
    { identifier: 'dupe-hd', title: 'House On Haunted Hill-hd' },
    { identifier: 'dupe-720', title: 'House On Haunted Hill 720p' },
    { identifier: 'dupe-bluray', title: 'House on Haunted Hill (1959) [P&M] 1080p Blu-Ray (6.6GB)', year: '1959' },
    { identifier: 'dupe-fullhd', title: 'House on Haunted Hill (1959, Full HD)', year: '1959' },
    { identifier: 'dupe-color', title: 'House On Haunted Hill (1959) [Colorized, 4K, 60FPS]' },
    { identifier: 'dupe-the2', title: 'House On The Haunted Hill (1959, Horror, Vincent Price, Colorized)', year: '1959' },
    { identifier: 'dupe-year', title: 'House On Haunted Hill 1959', year: '1959' },
    { identifier: 'dupe-wide', title: 'HOUSE ON HAUNTED HILL widescreen & video quality upgrade' },
    { identifier: 'dupe-file', title: 'house_on_haunted_hill_512kb' },
    { identifier: 'dupe-full', title: 'House On Haunted Hill Full Movie' },
    { identifier: 'keep-trailer', title: 'House on Haunted Hill [1959] - Trailer', year: '1959' },
    { identifier: 'keep-hosted', title: 'Beware Theater presents House On Haunted Hill' },
    { identifier: 'keep-sequel', title: 'Return To House On Haunted Hill' },
    { identifier: 'keep-article', title: 'Phantom Ship , The', year: '1936' },
    { identifier: 'dupe-article', title: 'The Phantom Ship', year: '1936' }
  ]);
  try {
    const result = await archiveService.fetchFiltered({});
    assert.deepEqual(result.movies.map(m => m.identifier),
      ['dupe-bluray', 'keep-trailer', 'keep-hosted', 'keep-sequel', 'keep-article']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchFiltered keeps different films that share a title', async () => {
  const realFetch = globalThis.fetch;
  mockDocs([
    { identifier: 'bat-1926', title: 'The Bat', year: '1926' },
    { identifier: 'bat-1959', title: 'The Bat (1959)' },
    { identifier: 'bat-1959-again', title: 'The Bat', year: '1959' },
    { identifier: 'bat-unknown', title: 'The Bat' }
  ]);
  try {
    const result = await archiveService.fetchFiltered({});
    assert.deepEqual(result.movies.map(m => m.identifier), ['bat-1926', 'bat-1959']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchFiltered ignores a metadata year that is just the upload year', async () => {
  const realFetch = globalThis.fetch;
  mockDocs([
    { identifier: 'film', title: 'House on Haunted Hill', year: '1959', publicdate: '2008-03-01T00:00:00Z' },
    { identifier: 'reupload', title: 'The House on Haunted Hill', year: '2020', publicdate: '2020-10-31T00:00:00Z' },
    { identifier: 'file', title: 'house_on_haunted_hill_512kb', year: '2025', publicdate: '2025-01-05T00:00:00Z' },
    { identifier: 'remake', title: 'House on Haunted Hill (1999)', year: '2021', publicdate: '2021-06-01T00:00:00Z' }
  ]);
  try {
    const result = await archiveService.fetchFiltered({});
    assert.deepEqual(result.movies.map(m => m.identifier), ['film', 'remake']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('only feature-film collections default to the 40 minute minimum', async () => {
  const { defaultMinRuntime, VIDEO_CATEGORIES } = await import('./archive.js');
  for (const id of ['feature_films', 'moviesandfilms', 'Film_Noir', 'SciFi_Horror']) {
    assert.equal(defaultMinRuntime(id), 40, id);
  }
  // Cartoons, Prelinger films and most uploads are short or have no runtime recorded
  for (const id of ['animationandcartoons', 'prelinger', 'silent_films', 'television', 'artsandmusicvideos']) {
    assert.equal(defaultMinRuntime(id), 0, id);
  }
  assert.equal(defaultMinRuntime('not-a-collection'), 0);
  assert.ok(VIDEO_CATEGORIES.some(c => c.id === 'gamevideos'), 'Video Games uses the live collection id');
});

test('runtimeFilter only excludes films whose runtime is known and wrong', async () => {
  const { runtimeFilter } = await import('./archive.js');
  const full = runtimeFilter({ minRuntime: 40 });
  assert.equal(full({ runtimeMinutes: 90 }), true);
  assert.equal(full({ runtimeMinutes: 12 }), false);
  assert.equal(full({ runtimeMinutes: 0 }), true, 'no runtime recorded is not evidence of a short');

  const shorts = runtimeFilter({ shorts: true });
  assert.equal(shorts({ runtimeMinutes: 12 }), true);
  assert.equal(shorts({ runtimeMinutes: 90 }), false);
  assert.equal(shorts({ runtimeMinutes: 0 }), true);
});

test('fetchMovies retries when Archive.org fails transiently', async () => {
  const realFetch = globalThis.fetch;
  const ok = { ok: true, json: async () => ({ response: { docs: [{ identifier: 'a', title: 'A' }], numFound: 1 } }) };
  try {
    // A 502 from Archive.org's edge has no CORS header, so browsers surface it as a thrown TypeError
    let calls = 0;
    globalThis.fetch = async () => { calls++; if (calls === 1) throw new TypeError('Failed to fetch'); if (calls === 2) return { ok: false, status: 502 }; return ok; };
    const result = await archiveService.fetchMovies({ retryDelayMs: 0 });
    assert.equal(result.movies.length, 1);
    assert.equal(calls, 3);

    calls = 0;
    globalThis.fetch = async () => { calls++; return { ok: false, status: 502 }; };
    await assert.rejects(() => archiveService.fetchMovies({ retryDelayMs: 0 }), /502/);
    assert.equal(calls, 3, 'gives up after 3 attempts');

    calls = 0;
    globalThis.fetch = async () => { calls++; return { ok: false, status: 400 }; };
    await assert.rejects(() => archiveService.fetchMovies({ retryDelayMs: 0 }), /400/);
    assert.equal(calls, 1, 'a bad request is not retried');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('buildQuery excludes collection items, which are folders rather than videos', () => {
  for (const options of [{ collection: 'feature_films' }, { searchQuery: 'casablanca' }, { collection: 'Film_Noir', genre: 'Horror' }]) {
    const query = archiveService.buildQuery(options);
    assert.ok(query.endsWith(' AND NOT mediatype:collection'), query);
  }
});

test('buildQuery: the collection and the genre both always apply, so the two filters never disagree', async () => {
  const { ALL_FILMS } = await import('./archive.js');
  const films = 'collection:(feature_films OR moviesandfilms OR Film_Noir OR SciFi_Horror OR silent_films)';
  // "All Films" is a real choice in the dropdown, and the default
  assert.ok(archiveService.buildQuery({ collection: ALL_FILMS }).startsWith(`${films} AND NOT mediatype`));
  assert.ok(archiveService.buildQuery({ collection: ALL_FILMS, genre: 'Horror' }).startsWith(`${films} AND subject:(`));
  // A genre inside a collection narrows that collection. It used to switch to every film
  // collection behind the dropdown's back, which still said "Sci-Fi & Horror".
  const narrowed = archiveService.buildQuery({ collection: 'SciFi_Horror', genre: 'Comedy' });
  assert.ok(narrowed.startsWith('collection:"SciFi_Horror" AND subject:('), narrowed);
  assert.ok(!narrowed.includes('feature_films'), narrowed);
  // A search still covers every collection the app offers
  assert.ok(archiveService.buildQuery({ collection: 'Film_Noir', genre: 'Horror', searchQuery: 'dracula' }).includes(' OR television OR '));
});

test('All Films starts on the 40 minute minimum, like the feature collections', async () => {
  const { ALL_FILMS, defaultMinRuntime } = await import('./archive.js');
  assert.equal(defaultMinRuntime(ALL_FILMS), 40);
});

test('a film year comes from the title first, and an upload-year value counts as unknown', async () => {
  const realFetch = globalThis.fetch;
  mockDocs([
    { identifier: 'a', title: 'House on Haunted Hill (1999)', year: '2021', publicdate: '2021-06-01T00:00:00Z' },
    { identifier: 'b', title: 'A Reuploaded Film', year: '2020', publicdate: '2020-10-31T00:00:00Z' },
    { identifier: 'c', title: 'A Properly Dated Film', year: '1959', publicdate: '2008-03-01T00:00:00Z' },
    { identifier: 'd', title: 'In The Year 2889', year: '1967', publicdate: '2010-01-01T00:00:00Z' }
  ]);
  try {
    const { movies } = await archiveService.fetchMovies({});
    assert.deepEqual(movies.map(m => m.year), [1999, null, 1959, 1967]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('buildSuggestQuery matches word prefixes in titles and tags across the film collections', () => {
  const query = archiveService.buildSuggestQuery('Haun hou');
  assert.equal(query, 'collection:(feature_films OR moviesandfilms OR Film_Noir OR SciFi_Horror OR silent_films) AND (title:(haun* AND hou*) OR subject:(haun* AND hou*)) AND NOT mediatype:collection');
  assert.equal(archiveService.buildSuggestQuery('a'), null, 'too short to be worth a request');
  assert.equal(archiveService.buildSuggestQuery('"" ()'), null);
});

test('suggest returns a few distinct films and can be cancelled without retrying', async () => {
  const realFetch = globalThis.fetch;
  try {
    mockDocs([
      { identifier: 'n1', title: 'Nosferatu', year: '1922', downloads: 900 },
      { identifier: 'n2', title: 'Nosferatu_DVD_quality', year: '1922', downloads: 800 },
      { identifier: 'n3', title: 'Nosferatu the Vampyre', year: '1979', downloads: 700 },
    ]);
    const { films } = await archiveService.suggest('nosf');
    assert.deepEqual(films.map(f => f.identifier), ['n1', 'n3'], 're-uploads of one film collapse into one suggestion');

    let calls = 0;
    globalThis.fetch = async (url, { signal } = {}) => { calls++; const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
    await assert.rejects(() => archiveService.suggest('dracula', { signal: new AbortController().signal }), { name: 'AbortError' });
    assert.equal(calls, 1, 'a cancelled request is not retried');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Full Movies drops trailers that have no runtime, but not films that come with trailers', async () => {
  const { runtimeFilter } = await import('./archive.js');
  const full = runtimeFilter({ minRuntime: 40 });
  // Real titles from Movies & Films; none of them has a runtime recorded
  assert.equal(full({ runtimeMinutes: 0, title: 'Night of the living dead Trailer' }), false);
  assert.equal(full({ runtimeMinutes: 0, title: 'Sita Sings the Blues Trailer 2008 - 640x360' }), false);
  assert.equal(full({ runtimeMinutes: 0, title: 'Psycho (1960) teaser' }), false);
  assert.equal(full({ runtimeMinutes: 0, title: 'Wheels On Meals aka Spartan X (1984) with Trailers' }), true);
  assert.equal(full({ runtimeMinutes: 0, title: 'Armour Of God & Operation Condor (& Trailers)' }), true);
  assert.equal(full({ runtimeMinutes: 0, title: 'Escape From Sobibor' }), true);
  assert.equal(full({ runtimeMinutes: 95, title: 'Trailer Park of Terror' }), true, 'a known runtime decides on its own');
  assert.equal(runtimeFilter({ shorts: true })({ runtimeMinutes: 0, title: 'Night of the living dead Trailer' }), true, 'Shorts is where trailers belong');
});

test('buildQuery: a decade matches a release date in it, or a year from it in the title', () => {
  const query = archiveService.buildQuery({ collection: 'feature_films', decade: 1980 });
  assert.match(query, /AND \(\(date:\[1980-01-01 TO 1989-12-31\]\) OR title:\(1980 OR 1981 OR 1982 OR 1983 OR 1984 OR 1985 OR 1986 OR 1987 OR 1988 OR 1989\)\)/);
  assert.doesNotMatch(archiveService.buildQuery({ collection: 'feature_films' }), /date:/);
  assert.doesNotMatch(archiveService.buildQuery({ collection: 'feature_films', decade: 'abc' }), /date:/, 'junk from a URL is ignored');
});

test('buildQuery: sorting by release date leaves out dates that are really upload dates', () => {
  // Uploaders leave "date" at the upload date (Drunken Master, 1978, was dated 2026), or a year
  // before it. A date before 2000 cannot be one: nothing was uploaded to Archive.org that early.
  const query = archiveService.buildQuery({ collection: 'feature_films', dated: true });
  assert.match(query, /AND date:\[1880-01-01 TO \d{4}-12-31\] AND NOT \(\(year:2000 AND publicdate:\[2000-01-01 TO 2001-12-31\]\) OR /);
  assert.match(query, new RegExp(`year:${new Date().getFullYear()} AND publicdate`), 'covers the current year');
  assert.doesNotMatch(query, /year:1999 AND/);
  assert.ok(encodeURIComponent(query).length < 3000, 'Archive.org rejects much longer queries');
  // Within a decade, a year that is only in the title has an upload date, which would sort first
  const nineties = archiveService.buildQuery({ collection: 'feature_films', dated: true, decade: 1990 });
  assert.match(nineties, /AND date:\[1990-01-01 TO 1999-12-31\]/);
  assert.doesNotMatch(nineties, /title:\(1990|publicdate/);
});

test('buildQuery: decades from 2000 on only trust a date that is not the upload date', () => {
  const query = archiveService.buildQuery({ collection: 'feature_films', decade: 2000 });
  assert.match(query, /\(\(date:\[2000-01-01 TO 2009-12-31\] AND NOT \(\(year:2000 AND publicdate:\[2000-01-01 TO 2001-12-31\]\) OR .*year:2009 AND publicdate:\[2009-01-01 TO 2010-12-31\]\)\)\) OR title:\(2000 OR /);
  assert.doesNotMatch(query, /year:2010 AND/);
});

test('fetchMovies asks for dated films when sorting by release date, not for other sorts', async () => {
  const realFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(decodeURIComponent(String(url))); return { ok: true, json: async () => ({ response: { docs: [], numFound: 0 } }) }; };
  try {
    await archiveService.fetchMovies({ collection: 'feature_films', sortBy: 'date', sortOrder: 'desc' });
    await archiveService.fetchMovies({ collection: 'feature_films', sortBy: 'downloads', decade: 1950 });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.match(urls[0], /date:\[1880-01-01 TO \d{4}-12-31\] AND NOT \(\(year:2000/);
  assert.match(urls[1], /date:\[1950-01-01 TO 1959-12-31\]\) OR title:\(1950 OR/);
});

test('Full Movies drops an unknown-length upload that is too small to be a feature', async () => {
  const { runtimeFilter } = await import('./archive.js');
  const full = runtimeFilter({ minRuntime: 40 });
  // Real items from Movies & Films, "Top Rated": a film's name, no runtime, a trailer's file size
  assert.equal(full({ runtimeMinutes: 0, title: 'Do the Right Thing', sizeMB: 52 }), false);
  assert.equal(full({ runtimeMinutes: 0, title: 'Attack of the Super Monsters', sizeMB: 17 }), false);
  assert.equal(full({ runtimeMinutes: 0, title: 'Escape From Sobibor', sizeMB: 1469 }), true);
  assert.equal(full({ runtimeMinutes: 0, title: 'An old low-bitrate transfer', sizeMB: 140 }), true);
  assert.equal(full({ runtimeMinutes: 0, title: 'Size not reported' }), true, 'no size is not evidence either');
  assert.equal(runtimeFilter({ minRuntime: 0 })({ runtimeMinutes: 0, title: 'A cartoon', sizeMB: 20 }), true, 'collections with no minimum keep small files');
  assert.equal(runtimeFilter({ shorts: true })({ runtimeMinutes: 0, title: 'Do the Right Thing', sizeMB: 52 }), true);
});

test('normalizeMovie reports the upload size in megabytes', () => {
  assert.equal(archiveService.normalizeMovie({ identifier: 'a', title: 'A', item_size: 52_400_000 }).sizeMB, 52);
  assert.equal(archiveService.normalizeMovie({ identifier: 'a', title: 'A' }).sizeMB, null);
});

test('normalizeMovie keeps the uploader\'s tags, split the ways uploaders write them', () => {
  assert.deepEqual(archiveService.normalizeMovie({ identifier: 'a', title: 'A', subject: ['Horror; zombies', 'kung fu, martial arts'] }).tags, ['Horror', 'zombies', 'kung fu', 'martial arts']);
  assert.deepEqual(archiveService.normalizeMovie({ identifier: 'a', title: 'A', subject: 'Sci-Fi' }).tags, ['Sci-Fi']);
  assert.deepEqual(archiveService.normalizeMovie({ identifier: 'a', title: 'A' }).tags, []);
});

test('suggest finds films by title and tags by subject with a single request', async () => {
  const realFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(decodeURIComponent(String(url))); return { ok: true, json: async () => ({ response: { numFound: 3, docs: [
    { identifier: 'z1', title: 'White Zombie', subject: ['zombies', 'horror', 'white zombie'] },
    { identifier: 'z0', title: 'White Zombie (1932) HD', subject: ['White Zombie'] },
    { identifier: 'z2', title: 'Night of the Living Dead', subject: 'zombies; horror' },
    { identifier: 'z3', title: 'Zombies of the Stratosphere', subject: ['serial'] } ] } }) }; };
  try {
    const { films, tags } = await archiveService.suggest('zomb');
    assert.equal(urls.length, 1);
    assert.match(urls[0], /title:\(zomb\*\) OR subject:\(zomb\*\)/);
    assert.deepEqual(films.map(f => f.identifier), ['z1', 'z3'], 'only films whose title matches are offered as films, once each');
    assert.deepEqual(tags.map(t => t.label), ['zombies']);
    // 'white zombie' as a tag is that film's title, which the film rows already offer
    assert.ok(!tags.some(t => t.label === 'white zombie'));

    // ...but a theme that is also one upload's title stays: many films carry it
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ response: { numFound: 6, docs: [
      { identifier: 'k0', title: 'Kung Fu', subject: ['kung fu'] },
      ...[1, 2, 3, 4, 5].map(i => ({ identifier: `k${i}`, title: `Shaolin film ${i}`, subject: ['kung fu'] })) ] } }) });
    assert.deepEqual((await archiveService.suggest('kung')).tags.map(t => t.label), ['kung fu']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('genre lives in the pills only: genre-named collections are not offered in the dropdown', async () => {
  const { BROWSABLE_COLLECTIONS, VIDEO_CATEGORIES, collectionChoice, ALL_FILMS } = await import('./archive.js');
  const offered = BROWSABLE_COLLECTIONS.map(c => c.id);
  assert.ok(!offered.includes('Film_Noir') && !offered.includes('SciFi_Horror'), 'a "Sci-Fi & Horror" dropdown beside an "All Genres" pill contradicts itself');
  assert.ok(offered.includes('feature_films') && offered.includes('silent_films') && offered.includes('animationandcartoons'));
  assert.ok(VIDEO_CATEGORIES.some(c => c.id === 'Film_Noir'), 'still a real collection: searches and the MCP tools use it');
  // Old links, pasted Archive.org links and suggestions for those collections become All Films + the pill
  assert.deepEqual(collectionChoice('Film_Noir'), { collection: ALL_FILMS, genre: 'Film Noir' });
  assert.deepEqual(collectionChoice('SciFi_Horror'), { collection: ALL_FILMS, genre: 'Horror' });
  assert.deepEqual(collectionChoice('silent_films'), { collection: 'silent_films', genre: null });
  assert.deepEqual(collectionChoice(ALL_FILMS), { collection: ALL_FILMS, genre: null });
});

test('buildQuery: the Film Noir pill includes the curated Film Noir collection, tagged or not', async () => {
  const { ALL_FILMS } = await import('./archive.js');
  const noir = archiveService.buildQuery({ collection: ALL_FILMS, genre: 'Film Noir' });
  assert.match(noir, /AND \(subject:\("Film Noir"[^)]*\) OR collection:\(Film_Noir\)\)/);
  // Sci-Fi & Horror mixes two genres, so it is not poured into either pill
  assert.doesNotMatch(archiveService.buildQuery({ collection: ALL_FILMS, genre: 'Horror' }), /OR collection:\(/);
});

test('a hung Archive.org request times out into an error instead of loading forever', async (t) => {
  const realFetch = globalThis.fetch;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // A fetch that only ever ends when its signal aborts, like a request Archive.org never answers
  globalThis.fetch = (url, { signal } = {}) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  try {
    // Three attempts (the transient-error retry), each allowed 15 s, with short pauses between
    const pending = archiveService.fetchMovies({ collection: 'feature_films', timeoutMs: 15000, retryDelayMs: 1 });
    let settled = false; pending.then(() => { settled = true; }, () => { settled = true; });
    t.mock.timers.tick(14000); await Promise.resolve(); assert.equal(settled, false, 'still waiting inside the limit');
    for (let i = 0; i < 6; i++) { t.mock.timers.tick(15000); await new Promise(resolve => setImmediate(resolve)); }
    await assert.rejects(pending, /took too long/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
