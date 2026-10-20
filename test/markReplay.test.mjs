import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  installMarkReplay,
  replayDataUrl,
  replayMark,
  replayTarget,
} from '../src/lib/markReplay.ts';

// An animated mark plays again when clicked (0.22.0, d-2026-10-20-st-mark-replay).

test('a link to this page replays here; another page of the site, next; another origin, away', () => {
  const at = 'https://ectropy.ai/';
  assert.equal(replayTarget('/', at), 'here');
  assert.equal(replayTarget(null, at), 'here');
  assert.equal(replayTarget('/index.html', at), 'here');
  assert.equal(replayTarget('/#top', at), 'here');
  assert.equal(replayTarget('/about/', 'https://ectropy.ai/about'), 'here');
  assert.equal(replayTarget('/', 'https://ectropy.ai/platform'), 'next');
  assert.equal(replayTarget('/?q=1', at), 'next');
  assert.equal(replayTarget('https://luh.tech/', at), 'away');
});

test('each replay is a distinct data: URL of the same SVG', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
  const a = replayDataUrl(svg, 1);
  const b = replayDataUrl(svg, 2);
  assert.notEqual(a, b);
  assert.ok(a.startsWith('data:image/svg+xml;charset=utf-8,'));
  assert.ok(decodeURIComponent(a.split(',')[1]).startsWith(svg));
});

test('inline markup restarts every CSS animation under it', () => {
  const calls = [];
  const anim = (id) => ({ cancel: () => calls.push(`cancel ${id}`), play: () => calls.push(`play ${id}`) });
  const el = { tagName: 'svg', getAnimations: (o) => (assert.deepEqual(o, { subtree: true }), [anim(1), anim(2)]) };
  replayMark(el);
  assert.deepEqual(calls, ['cancel 1', 'play 1', 'cancel 2', 'play 2']);
});

test('an <img> mark gets a fresh data: URL of its animated source, fetched once', async () => {
  const fetched = [];
  globalThis.fetch = async (url) => (fetched.push(url), { ok: true, text: async () => '<svg/>' });
  const img = { tagName: 'IMG', src: '/brand/lockup.svg', currentSrc: '', getAttribute: (k) => (k === 'data-mark-replay-src' ? '/brand/reveal.svg' : null) };
  replayMark(img);
  await new Promise((r) => setTimeout(r, 0));
  const first = img.src;
  replayMark(img);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(fetched, ['/brand/reveal.svg']);
  assert.ok(first.startsWith('data:image/svg+xml'));
  assert.notEqual(img.src, first);
});

function page({ reduced = false, href = 'https://ectropy.ai/' } = {}) {
  const replayed = [];
  const marks = ['nav', 'venture'].map((group) => ({
    tagName: 'svg',
    getAttribute: (k) => (k === 'data-mark-replay' ? group : null),
    getAnimations: () => [{ cancel() {}, play: () => replayed.push(group) }],
  }));
  let onClick;
  const doc = {
    querySelectorAll: () => marks,
    addEventListener: (type, fn) => { if (type === 'click') onClick = fn; },
  };
  const win = {
    matchMedia: () => ({ matches: reduced }),
    location: new URL(href),
  };
  return { doc, win, replayed, marks, click: (e) => onClick?.(e) };
}

function clickOn(mark, link) {
  let prevented = false;
  const target = { closest: (sel) => (sel === '[data-mark-replay]' ? Object.assign(mark, { closest: () => link }) : null) };
  return { e: { target, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, preventDefault: () => { prevented = true; } }, prevented: () => prevented };
}

test('a click on a mark linked to this page replays it without reloading', () => {
  const p = page();
  installMarkReplay(p.doc, p.win);
  const c = clickOn(p.marks[0], { href: 'https://ectropy.ai/', target: '', getAttribute: () => '/' });
  p.click(c.e);
  assert.equal(c.prevented(), true);
  assert.deepEqual(p.replayed, ['nav']);
});

test('a click on the logo from another page navigates and does not replay', () => {
  const p = page({ href: 'https://ectropy.ai/platform' });
  installMarkReplay(p.doc, p.win);
  const c = clickOn(p.marks[0], { href: 'https://ectropy.ai/', target: '', getAttribute: () => '/' });
  p.click(c.e);
  assert.equal(c.prevented(), false);
  assert.deepEqual(p.replayed, []);
});

test('a click away to another site does not replay', () => {
  const p = page();
  installMarkReplay(p.doc, p.win);
  const c = clickOn(p.marks[1], { href: 'https://hilja.ai/', target: '', getAttribute: () => 'https://hilja.ai/' });
  p.click(c.e);
  assert.equal(c.prevented(), false);
  assert.deepEqual(p.replayed, []);
});

test('under reduced motion a click does not replay', () => {
  const p = page({ reduced: true });
  installMarkReplay(p.doc, p.win);
  const c = clickOn(p.marks[0], null);
  p.click(c.e);
  assert.deepEqual(p.replayed, []);
});

test('SiteLayout installs the replay, and an animated VentureMark opts in', () => {
  const layout = readFileSync(new URL('../src/layouts/SiteLayout.astro', import.meta.url), 'utf8');
  assert.match(layout, /import \{ installMarkReplay \} from '\.\.\/lib\/markReplay';\s*installMarkReplay\(\);/);
  const mark = readFileSync(new URL('../src/components/VentureMark.astro', import.meta.url), 'utf8');
  assert.match(mark, /set:html=\{animated\.markup\}/);
  assert.match(mark, /data-mark-replay="venture"/);
});
