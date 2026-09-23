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
