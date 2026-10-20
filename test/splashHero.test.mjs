import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The intro is an option: "wordmark" (the default, every existing caller unchanged) plays the splash;
// "none" renders the photo hero alone, for a venture that animates its logo in the nav instead.
const src = readFileSync(new URL('../src/components/SplashHero.astro', import.meta.url), 'utf8');

test('the intro defaults to the wordmark splash', () => {
  assert.match(src, /intro = 'wordmark',/);
});

test('the splash layers render only for the wordmark intro', () => {
  const gate = src.indexOf("{intro === 'wordmark' && (<>");
  assert.ok(gate > 0);
  assert.ok(src.indexOf('class="splash-overlay"') > gate);
  assert.ok(src.indexOf('class="splash-wordmark-wrap"') > gate);
  assert.ok(src.indexOf('</>)}') > src.indexOf('set:html={wordmarkMarkup}'));
});

test('a wordmark intro without its markup is refused', () => {
  assert.match(src, /intro === 'wordmark' && \(!wordmarkMarkup \|\| !wordmarkViewBox \|\| !wordmarkAriaLabel\)/);
});
