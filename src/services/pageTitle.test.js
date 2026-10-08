import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageTitle, SITE_TITLE } from './pageTitle.js';

test('the landing view keeps the site title', () => {
  assert.equal(pageTitle({ genre: 'Horror', collection: 'all', search: '' }), SITE_TITLE);
  assert.equal(pageTitle({}), SITE_TITLE);
});

test('browsing names the search, genre and collection', () => {
  assert.equal(pageTitle({ genre: 'Western', collection: 'all' }), 'Western | Orphaned Films');
  assert.equal(pageTitle({ genre: 'Western', collection: 'feature_films' }), 'Western · Feature Films | Orphaned Films');
  assert.equal(pageTitle({ search: 'zombie', genre: 'all', collection: 'all' }), '"zombie" | Orphaned Films');
  assert.equal(pageTitle({ genre: 'all', collection: 'all' }), SITE_TITLE);
  assert.equal(pageTitle({ genre: 'Horror', collection: 'feature_films' }), 'Horror · Feature Films | Orphaned Films');
});

test('an open film names itself and its year once', () => {
  assert.equal(pageTitle({ movie: { title: 'Night of the Living Dead', year: 1968 } }), 'Night of the Living Dead (1968) | Orphaned Films');
  assert.equal(pageTitle({ movie: { title: 'Detour (1945)', year: 1945 } }), 'Detour (1945) | Orphaned Films');
  assert.equal(pageTitle({ movie: { title: 'Detour', year: null }, genre: 'Western' }), 'Detour | Orphaned Films');
});
