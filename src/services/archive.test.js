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
      year: 1954, runtimeMinutes: 90, runtime: '1:30:00', genres: ['Drama', 'Sci-Fi'],
      downloads: 42, rating: null, description: 'A test movie.', creator: 'Test Director',
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
  assert.equal(archiveService.buildQuery({ searchQuery: '"" ()', collection: 'SciFi_Horror' }), 'collection:"SciFi_Horror"');
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

  assert.equal(archiveService.buildQuery({ collection: 'SciFi_Horror' }), 'collection:"SciFi_Horror"');
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
      ['keep-film', 'keep-trailer', 'keep-hosted', 'keep-sequel', 'keep-article']);
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
