#!/usr/bin/env node
/**
 * Generates a site's raster icons and web manifest from its own
 * public/favicon.svg and brand-identity instance, into public/:
 *
 *   apple-touch-icon.png  180x180, mark on the brand canvas colour
 *                         (iOS fills transparency with black otherwise)
 *   icon-192.png          192x192, transparent
 *   icon-512.png          512x512, transparent
 *   site.webmanifest      name, short_name, icons, theme/background colour
 *   favicon.ico           16, 32 and 48px, transparent -- browsers and crawlers
 *                         request /favicon.ico whatever the page links
 *
 * SiteLayout links each of these only when the file exists, so running
 * this is what turns them on for a site. Re-run when favicon.svg or the
 * brand's name/colours change; output is deterministic for the same inputs.
 *
 * Usage:
 *   luhtech-sync-icons <path-to-brand-identity.json> [--public <dir>] [--check]
 *   luhtech-sync-icons content/brand/hilja.json
 *
 * --check writes nothing and exits 1 if any output is missing or stale.
 */
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APPLE_PADDING = 0.125; // fraction of the canvas left clear on each side

export function buildManifest(brand) {
  const name = brand?.identity?.name;
  if (!name) throw new Error('brand identity.name is required');
  const ink = brand?.color?.foundation?.ink?.hex;
  const canvas = brand?.color?.foundation?.canvas?.hex;
  const manifest = {
    name,
    short_name: name,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    start_url: '/',
    display: 'browser',
  };
  if (ink) manifest.theme_color = ink;
  if (canvas) manifest.background_color = canvas;
  return JSON.stringify(manifest, null, 2) + '\n';
}

// Places the mark inside a square of the given background colour with
// padding, by wrapping the source SVG as a nested <svg> element.
export function paddedSvg(svg, background, padding = APPLE_PADDING) {
  const viewBox = svg.match(/viewBox=["']([^"']+)["']/)?.[1];
  if (!viewBox) throw new Error('favicon.svg has no viewBox');
  const inner = svg.replace(/^[\s\S]*?<svg\b/, '<svg').replace(/<svg\b([^>]*)>/, (_, attrs) => {
    const kept = attrs.replace(/\s(width|height|x|y)=["'][^"']*["']/g, '');
    const pos = (padding * 100).toFixed(3);
    const size = ((1 - 2 * padding) * 100).toFixed(3);
    return `<svg${kept} x="${pos}" y="${pos}" width="${size}" height="${size}">`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${background}"/>${inner}</svg>`;
}

export const ICO_SIZES = [16, 32, 48];

// An ICO file holding PNG images (supported by every current browser and
// by Windows since Vista): a 6-byte header, one 16-byte directory entry
// per image, then the PNG bytes themselves.
export function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette colours
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

async function render(svg, size) {
  const { Resvg } = await import('@resvg/resvg-js');
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

async function main() {
  const args = process.argv.slice(2);
  const brandPath = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--public');
  const publicIdx = args.indexOf('--public');
  const publicDir = resolve(process.cwd(), publicIdx >= 0 ? args[publicIdx + 1] : 'public');
  const check = args.includes('--check');
  if (!brandPath) {
    console.error('Usage: luhtech-sync-icons <path-to-brand-identity.json> [--public <dir>] [--check]');
    process.exit(1);
  }
  const brand = JSON.parse(readFileSync(brandPath, 'utf-8'));
  const svgPath = join(publicDir, 'favicon.svg');
  if (!existsSync(svgPath)) {
    console.error(`No favicon.svg at ${svgPath}`);
    process.exit(1);
  }
  const svg = readFileSync(svgPath, 'utf-8');
  const canvas = brand?.color?.foundation?.canvas?.hex ?? '#FFFFFF';

  const outputs = [
    ['apple-touch-icon.png', await render(paddedSvg(svg, canvas), 180)],
    ['icon-192.png', await render(svg, 192)],
    ['icon-512.png', await render(svg, 512)],
    ['site.webmanifest', Buffer.from(buildManifest(brand))],
    ['favicon.ico', buildIco(await Promise.all(ICO_SIZES.map(async (size) => ({ size, data: await render(svg, size) }))))],
  ];

  let stale = 0;
  for (const [file, data] of outputs) {
    const dest = join(publicDir, file);
    const current = existsSync(dest) ? readFileSync(dest) : null;
    if (current && Buffer.compare(current, data) === 0) continue;
    stale++;
    console.log(`  ${current ? '~' : '+'} ${file}`);
    if (!check) writeFileSync(dest, data);
  }
  console.log(`${check ? '[check] ' : ''}${stale} of ${outputs.length} ${check ? 'missing or stale' : 'written'}.`);
  if (check && stale > 0) process.exitCode = 1;
}

// Run as a CLI (including through node_modules/.bin's symlink), not on import from tests.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
