import test from 'node:test';
import assert from 'node:assert/strict';
import { validEvent, commandsFor } from '../../api/_stats.js';

test('TV events are accepted and counted per channel', () => {
  const tune = validEvent({ name: 'TV', data: { action: 'tune', channel: 'atomic-age' } });
  assert.deepEqual(tune, { name: 'TV', data: { action: 'tune', channel: 'atomic-age' } });
  const keys = commandsFor(tune, { now: new Date('2026-09-23T12:00:00Z') }).filter(c => c[0] === 'ZINCRBY').map(c => `${c[1]} ${c[3]}`);
  assert.deepEqual(keys, ['stats:tv:2026-09 tune', 'stats:tuned:2026-09 atomic-age']);

  const watched = validEvent({ name: 'TV', data: { action: 'watched 10 minutes', channel: 'mine', film: 'hellhole.-1985' } });
  assert.ok(commandsFor(watched).some(c => c[1].startsWith('stats:stayed:') && c[3] === 'mine'));

  // Adding a film carries the film, not a channel
  assert.ok(validEvent({ name: 'TV', data: { action: 'add to my channel', film: 'hellhole.-1985' } }));
});

test('TV events with an unknown action or a malformed channel are refused', () => {
  assert.equal(validEvent({ name: 'TV', data: { action: 'hack', channel: 'atomic-age' } }), null);
  assert.equal(validEvent({ name: 'TV', data: { action: 'tune', channel: 'Atomic Age!<script>' } }), null);
});
