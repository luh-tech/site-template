import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeoHead, canonicalUrl, ICON_FILES } from '../src/lib/seoHead.ts';
import { checkHtml } from '../bin/luhtech-seo-check.mjs';
import { buildManifest, paddedSvg } from '../bin/luhtech-sync-icons.mjs';

const BRAND = {
  identity: { name: 'Hilja' },
  color: { foundation: { ink: { hex: '#0D0D0D' }, canvas: { hex: '#F5F5F0' } } },
};
const ALL_FILES = new Set(Object.values(ICON_FILES));

test('canonicalUrl joins the pathname onto the configured site', () => {
  assert.equal(canonicalUrl('https://hilja.ai', '/'), 'https://hilja.ai/');
  assert.equal(canonicalUrl(new URL('https://luh.tech'), '/insights/lever-loop-ledger/'), 'https://luh.tech/insights/lever-loop-ledger/');
  assert.equal(canonicalUrl(undefined, '/'), null);
});

test('buildSeoHead links only the icon files the site ships', () => {
  const none = buildSeoHead({ site: 'https://hilja.ai', pathname: '/', publicFiles: new Set() });
  assert.deepEqual(none.links.map((l) => l.rel), ['canonical']);

  const svgOnly = buildSeoHead({ site: 'https://hilja.ai', pathname: '/', publicFiles: new Set(['favicon.svg']) });
  assert.deepEqual(svgOnly.links.map((l) => l.href), ['https://hilja.ai/', '/favicon.svg']);

  const all = buildSeoHead({ site: 'https://hilja.ai', pathname: '/', brand: BRAND, publicFiles: ALL_FILES });
  assert.deepEqual(all.links.map((l) => l.rel), ['canonical', 'icon', 'icon', 'apple-touch-icon', 'manifest']);
});

test('buildSeoHead takes site name and theme colour from the brand, locale defaults to en_US', () => {
  const head = buildSeoHead({ site: 'https://hilja.ai', pathname: '/', brand: BRAND, publicFiles: ALL_FILES });
  assert.equal(head.siteName, 'Hilja');
  assert.equal(head.themeColor, '#0D0D0D');
  assert.equal(head.locale, 'en_US');
  const bare = buildSeoHead({ pathname: '/', publicFiles: new Set() });
  assert.equal(bare.siteName, null);
  assert.equal(bare.themeColor, null);
  assert.equal(bare.canonical, null);
});

const GOOD = `<!doctype html><html lang="en"><head><title>Hilja -- Acoustics that adapt</title>
<meta name="description" content="Intelligent surfaces that tune a room to how it is being used, panel by panel, as the room changes.">
<link rel="canonical" href="https://hilja.ai/"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:image" content="https://example.com/og.png"></head><body><h1>Hilja</h1></body></html>`;

test('checkHtml passes a complete page', () => {
  assert.deepEqual(checkHtml(GOOD), { errors: [], warnings: [] });
});

test('checkHtml errors on missing icon, canonical and og:image -- the live gaps', () => {
  const html = GOOD.replace(/<link rel="canonical"[^>]*>/, '').replace(/<link rel="icon"[^>]*>/, '').replace(/<meta property="og:image"[^>]*>/, '');
  assert.deepEqual(checkHtml(html).errors, ['missing canonical link', 'missing icon link', 'missing og:image']);
});

test('checkHtml warns (does not error) on long titles, short descriptions and h1 count', () => {
  const html = GOOD.replace('Hilja -- Acoustics that adapt', 'Q'.repeat(61))
    .replace(/content="Intelligent[^"]*"/, 'content="Too short."')
    .replace('<h1>Hilja</h1>', '<h1>a</h1><h1>b</h1>');
  const { errors, warnings } = checkHtml(html);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 3);
});

test('checkHtml treats rel="icon" inside a multi-token rel as an icon link', () => {
  assert.deepEqual(checkHtml(GOOD.replace('rel="icon"', 'rel="shortcut icon"')).errors, []);
});

test('buildManifest carries name, icons and brand colours', () => {
  const m = JSON.parse(buildManifest(BRAND));
  assert.equal(m.name, 'Hilja');
  assert.equal(m.theme_color, '#0D0D0D');
  assert.equal(m.background_color, '#F5F5F0');
  assert.deepEqual(m.icons.map((i) => i.sizes), ['192x192', '512x512']);
  assert.throws(() => buildManifest({ identity: {} }), /identity.name/);
});

test('paddedSvg nests the mark inside a filled, padded square', () => {
  const out = paddedSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="32" height="32"><rect/></svg>', '#F5F5F0');
  assert.match(out, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#F5F5F0"\/>/);
  assert.match(out, /x="12.500" y="12.500" width="75.000" height="75.000"/);
  assert.doesNotMatch(out, /width="32"/);
  assert.throws(() => paddedSvg('<svg><rect/></svg>', '#fff'), /viewBox/);
});
