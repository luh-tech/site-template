// luhtech-device-smoke's checks that need no browser (d-2026-10-19-sr-site-devices).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devicesFor, installProblems, viewportProblems, DEVICE_VIEWPORTS } from '../bin/luhtech-device-smoke.mjs';
import { buildSeoHead } from '../src/lib/seoHead.ts';

test('a site without devices is held to phone, tablet and desktop', () => {
  assert.deepEqual(devicesFor(null), ['phone', 'tablet', 'desktop']);
  assert.deepEqual(devicesFor({}), ['phone', 'tablet', 'desktop']);
  assert.deepEqual(devicesFor({ devices: { supported: ['desktop'] } }), ['desktop']);
});

test('the tablet is checked held both ways', () => {
  assert.deepEqual(DEVICE_VIEWPORTS.tablet.map((v) => [v.width, v.height]), [[820, 1180], [1180, 820]]);
});

test('the viewport must be device-width and must not lock zoom', () => {
  assert.deepEqual(viewportProblems('width=device-width, initial-scale=1'), []);
  assert.deepEqual(viewportProblems(null), ['no viewport meta']);
  assert.ok(viewportProblems('width=1024').length);
  assert.ok(viewportProblems('width=device-width, user-scalable=no').some((p) => p.includes('locks zoom')));
  assert.ok(viewportProblems('width=device-width, maximum-scale=1').some((p) => p.includes('locks zoom')));
  assert.deepEqual(viewportProblems('width=device-width, maximum-scale=5'), []);
});

test('an installable page needs a manifest, an apple-touch-icon and the web-app meta', () => {
  const full =
    '<link rel="manifest" href="/site.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">' +
    '<meta name="apple-mobile-web-app-capable" content="yes">';
  assert.deepEqual(installProblems(full), []);
  assert.equal(installProblems('<link rel="icon" href="/favicon.svg">').length, 3);
});

test('buildSeoHead adds the web-app meta only for an installable site', () => {
  const base = { site: 'https://ectropy.ai', pathname: '/', publicFiles: new Set(), brand: { identity: { name: 'Ectropy' } } };
  assert.deepEqual(buildSeoHead(base).metas, []);
  assert.deepEqual(buildSeoHead({ ...base, devices: { supported: ['phone'] } }).metas, []);
  const metas = buildSeoHead({ ...base, devices: { supported: ['phone', 'tablet', 'desktop'], installable: true } }).metas;
  assert.deepEqual(metas.map((m) => m.name), [
    'mobile-web-app-capable',
    'apple-mobile-web-app-capable',
    'apple-mobile-web-app-status-bar-style',
    'apple-mobile-web-app-title',
  ]);
  assert.equal(metas.find((m) => m.name === 'apple-mobile-web-app-title').content, 'Ectropy');
});
