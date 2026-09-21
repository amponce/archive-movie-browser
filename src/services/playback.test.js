import test from 'node:test';
import assert from 'node:assert/strict';
import { pickPlayableFile, videoUrl, shortcutFor, resumeTime, rememberPosition } from './playback.js';

// Real file lists from Archive.org, trimmed to the fields used
const deadPeople = [
  { name: 'dead_people.asr.srt', format: 'SubRip', source: 'original', size: '90000' },
  { name: 'dead_people.mp4', format: 'MPEG4', source: 'original', size: '975000000' },
  { name: 'dead_people.ogv', format: 'Ogg Video', source: 'derivative', size: '384000000' },
  { name: 'dead_people_512kb.mp4', format: '512Kb MPEG4', source: 'derivative', size: '380000000' },
  { name: 'dead_people.thumbs/dead_people_000001.jpg', format: 'Thumbnail', source: 'derivative', size: '9000' },
];

test('pickPlayableFile prefers an h.264 derivative, then the original mp4, then the small mp4', () => {
  assert.equal(pickPlayableFile([...deadPeople, { name: 'dead_people.ia.mp4', format: 'h.264 IA', source: 'derivative', size: '600000000' }]).name, 'dead_people.ia.mp4');
  assert.equal(pickPlayableFile(deadPeople).name, 'dead_people.mp4');
  assert.equal(pickPlayableFile(deadPeople.filter(f => f.name !== 'dead_people.mp4')).name, 'dead_people_512kb.mp4');
});

test('pickPlayableFile skips a master too big to stream, and gives up when nothing can play in a browser', () => {
  const huge = [{ name: 'film.mp4', format: 'MPEG4', source: 'original', size: String(9e9) }, { name: 'film_512kb.mp4', format: '512Kb MPEG4', source: 'derivative', size: '300000000' }];
  assert.equal(pickPlayableFile(huge).name, 'film_512kb.mp4');
  assert.equal(pickPlayableFile([{ name: 'film.avi', format: 'Cinepack', source: 'original', size: '1' }, { name: 'film.ogv', format: 'Ogg Video', source: 'derivative', size: '1' }]), null, 'Safari cannot play Ogg: use the Archive.org player');
  assert.equal(pickPlayableFile(undefined), null);
});

test('videoUrl escapes each part of the path', () => {
  assert.equal(videoUrl('Cops1922', 'Cops-v2.mp4'), 'https://archive.org/download/Cops1922/Cops-v2.mp4');
  assert.equal(videoUrl('some_item', 'disc 1/The Film #2.mp4'), 'https://archive.org/download/some_item/disc%201/The%20Film%20%232.mp4');
});

test('shortcutFor maps keys to player actions and stays out of the way of typing and browser shortcuts', () => {
  const key = (k, extra = {}) => ({ key: k, target: { tagName: 'BODY' }, ...extra });
  assert.deepEqual(shortcutFor(key('ArrowRight')), { seek: 10 });
  assert.deepEqual(shortcutFor(key('ArrowLeft')), { seek: -10 });
  assert.deepEqual(shortcutFor(key('ArrowRight', { shiftKey: true })), { seek: 60 });
  assert.deepEqual(shortcutFor(key(' ')), { toggle: true });
  assert.deepEqual(shortcutFor(key('k')), { toggle: true });
  assert.deepEqual(shortcutFor(key('f')), { fullscreen: true });
  assert.deepEqual(shortcutFor(key('M')), { mute: true });
  assert.equal(shortcutFor(key('Escape')), null, 'the dialog closes itself');
  assert.equal(shortcutFor(key('f', { metaKey: true })), null, 'Cmd+F is the browser\'s');
  assert.equal(shortcutFor(key('ArrowLeft', { altKey: true })), null, 'Alt+Left is Back');
  assert.equal(shortcutFor(key('k', { target: { tagName: 'INPUT' } })), null);
  assert.equal(shortcutFor(key(' ', { target: { tagName: 'BUTTON' } })), null, 'Space on a button presses the button');
});

test('resumeTime only resumes when it is worth it', () => {
  assert.equal(resumeTime({ time: 2467, duration: 5374 }), 2467);
  assert.equal(resumeTime({ time: 12, duration: 5374 }), 0, 'barely started');
  assert.equal(resumeTime({ time: 5350, duration: 5374 }), 0, 'in the credits: start over');
  assert.equal(resumeTime(undefined), 0);
});

test('rememberPosition keeps the most recent 50 films', () => {
  let saved = {};
  for (let i = 0; i < 55; i++) saved = rememberPosition(saved, `film${i}`, { time: 100 + i, duration: 5000 }, 1000 + i);
  assert.equal(Object.keys(saved).length, 50);
  assert.equal(saved.film0, undefined);
  assert.deepEqual(saved.film54, { time: 154, duration: 5000, at: 1054 });
});
