import test from 'node:test';
import assert from 'node:assert/strict';
import { toVtt, validSubtitleRequest, decodeText } from '../../api/_subtitles.js';

test('toVtt turns SubRip into WebVTT, including Archive.org\'s two-digit fractions', () => {
  const srt = '\uFEFF1\r\n00:00:48,26 --> 00:00:48,43\r\nAnd.\r\n\r\n2\r\n01:01:11,540 --> 01:01:13,290\r\n<i>Hello</i>\r\n';
  assert.equal(toVtt(srt), 'WEBVTT\n\n1\n00:00:48.260 --> 00:00:48.430\nAnd.\n\n2\n01:01:11.540 --> 01:01:13.290\n<i>Hello</i>\n');
  assert.ok(toVtt('WEBVTT\n\n00:01.000 --> 00:02.000\nHi\n').startsWith('WEBVTT\n'), 'WebVTT passes through');
});

test('subtitle requests only name a subtitle file inside one upload', () => {
  assert.ok(validSubtitleRequest('sex_madness', 'sex_madness.asr.srt'));
  assert.ok(validSubtitleRequest('rio', 'That.Man.from.Rio.1964_english.srt'));
  assert.ok(!validSubtitleRequest('rio', '../../etc/passwd.srt'));
  assert.ok(!validSubtitleRequest('rio', 'film.mp4'));
  assert.ok(!validSubtitleRequest('bad id', 'x.srt'));
});

test('decodeText reads UTF-8, and old Windows-1252 subtitle files without garbling accents', () => {
  assert.equal(decodeText(new TextEncoder().encode('Déjà vu')), 'Déjà vu');
  assert.equal(decodeText(new Uint8Array([0x44, 0xe9, 0x6a, 0xe0])), 'Déjà'); // Windows-1252 bytes
});
