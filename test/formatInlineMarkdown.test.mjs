import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatInlineMarkdown } from '../src/lib/formatInlineMarkdown.ts';

// d-2026-09-16-sr-inline-markdown-rendering. Found live: every real
// bridged article's **bold**/[link](url) markdown was rendering as
// literal characters on production pages (Block.astro had never parsed
// block.text as markdown at all). These are the real strings pulled
// straight from luh.tech/insights/the-fifth-change-order/ before the fix.

test('bold renders as a real <strong>, not literal asterisks', () => {
  const out = formatInlineMarkdown('None of that is a failure of your people. **It is the unit of record.**');
  assert.equal(out, 'None of that is a failure of your people. <strong>It is the unit of record.</strong>');
});

test('a same-site markdown link renders as a real internal anchor, no target=_blank', () => {
  const out = formatInlineMarkdown('Request a demo. [Request a demo](/contact/)');
  assert.match(out, /<a href="\/contact\/" class="[^"]+">Request a demo<\/a>/);
  assert.doesNotMatch(out, /target="_blank"/);
});

test('an https:// markdown link renders as a real external anchor with target=_blank', () => {
  const out = formatInlineMarkdown('See [the docs](https://example.com/page) for more.');
  assert.match(out, /<a href="https:\/\/example\.com\/page" class="[^"]+" target="_blank" rel="noopener noreferrer">the docs<\/a>/);
});

test('italic renders as a real <em>', () => {
  const out = formatInlineMarkdown('_italic_ text');
  assert.equal(out, '<em>italic</em> text');
});

test('an unsafe href (javascript:) is left as literal, unlinked text', () => {
  const out = formatInlineMarkdown('A bad link [x](javascript:alert(1)) stays literal.');
  assert.equal(out, 'A bad link [x](javascript:alert(1)) stays literal.');
});

test('raw HTML in the source text is escaped before any formatting runs', () => {
  const out = formatInlineMarkdown('A **bold** claim with a <script>alert(1)</script> attempt.');
  assert.equal(out, 'A <strong>bold</strong> claim with a &lt;script&gt;alert(1)&lt;/script&gt; attempt.');
});

test('plain text with no markdown passes through unchanged (escaped)', () => {
  const out = formatInlineMarkdown('Plain sentence, no formatting.');
  assert.equal(out, 'Plain sentence, no formatting.');
});
