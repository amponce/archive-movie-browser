import test from 'node:test';
import assert from 'node:assert/strict';
import { plainText } from './plainText.js';

test('plainText turns an Archive.org description into text', () => {
  assert.equal(plainText('Just a list <h3 class="x" style="font-family:\'Helvetica Neue\';">of movies mp4 files.</h3>'), 'Just a list of movies mp4 files.');
  assert.equal(plainText('2021 Xmas Poem<br />'), '2021 Xmas Poem');
  assert.equal(plainText('Line one<br>Line two<p>Para</p>'), 'Line one\nLine two\nPara');
  assert.equal(plainText('Tom &amp; Jerry &quot;live&quot; &#39;now&#39; &lt;3 &nbsp;ok'), 'Tom & Jerry "live" \'now\' <3 ok');
  assert.equal(plainText('<script>alert(1)</script>Safe'), 'Safe');
  assert.equal(plainText(null), '');
  assert.equal(plainText(['first', 'second']), 'first\nsecond', 'Archive.org sometimes sends a list');
});

test('plainText survives hostile descriptions: impossible characters and endless brackets', () => {
  assert.equal(plainText('a &#99999999; b &#x110000; c'), 'a b c', 'code points past Unicode are dropped, not thrown');
  const started = Date.now();
  plainText('<'.repeat(200000));
  plainText('<script>'.repeat(50000));
  assert.ok(Date.now() - started < 500, `took ${Date.now() - started} ms`);
});
