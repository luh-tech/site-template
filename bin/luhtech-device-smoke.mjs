#!/usr/bin/env node
/**
 * Loads every built HTML page under a site's dist/ at each device the site
 * supports and fails when a page does not work there
 * (d-2026-10-19-sr-site-devices; content/site.schema.json 1.5.0 `devices`).
 * Run after `astro build`, like luhtech-seo-check.
 *
 * Errors (exit 1), per page and device:
 *   - no viewport meta, or one without width=device-width, or one that locks
 *     zoom (user-scalable=no, maximum-scale=1)
 *   - the page is wider than the screen (horizontal scroll)
 *   - no visible way to navigate in the header (a link, or a menu button)
 *   - devices.installable and a manifest link, an apple-touch-icon or
 *     apple-mobile-web-app-capable missing
 *
 * Devices: phone 390x844 (touch), tablet 820x1180 and 1180x820 (touch),
 * desktop 1440x900. A site whose record omits `devices` is held to all three.
 *
 * Needs Playwright (an optional peer dependency) with Chromium installed:
 * `npm i -D playwright && npx playwright install chromium`.
 *
 * Usage: luhtech-device-smoke [dist-dir] [--site <content/sites/x.json>]
 */
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync, realpathSync, existsSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEVICE_VIEWPORTS = {
  phone: [{ label: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
  tablet: [
    { label: 'tablet portrait', width: 820, height: 1180, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    { label: 'tablet landscape', width: 1180, height: 820, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  ],
  desktop: [{ label: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }],
};

/** The devices a site is held to: its record's `devices.supported`, or all three. */
export function devicesFor(site) {
  const supported = site?.devices?.supported;
  return Array.isArray(supported) && supported.length ? supported : ['phone', 'tablet', 'desktop'];
}

/** Problems with a page's viewport meta content (null when there is none). */
export function viewportProblems(content) {
  if (content == null) return ['no viewport meta'];
  const c = content.replace(/\s+/g, '').toLowerCase();
  const problems = [];
  if (!c.includes('width=device-width')) problems.push('viewport is not width=device-width');
  if (/user-scalable=(no|0)/.test(c)) problems.push('viewport locks zoom (user-scalable=no)');
  if (/maximum-scale=1(\.0+)?(,|$)/.test(c)) problems.push('viewport locks zoom (maximum-scale=1)');
  return problems;
}

/** Install tags an installable page is missing. */
export function installProblems(html) {
  const tags = html.match(/<(link|meta)\b[^>]*>/gi) ?? [];
  const has = (re) => tags.some((t) => re.test(t));
  const problems = [];
  if (!has(/rel=["'][^"']*\bmanifest\b/i)) problems.push('installable, but no manifest link');
  if (!has(/rel=["'][^"']*\bapple-touch-icon\b/i)) problems.push('installable, but no apple-touch-icon');
  if (!has(/name=["']apple-mobile-web-app-capable["']/i)) problems.push('installable, but no apple-mobile-web-app-capable meta');
  return problems;
}

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...htmlFiles(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

function serve(dist) {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(dist, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function main() {
  const args = process.argv.slice(2);
  const siteAt = args.indexOf('--site');
  const sitePath = siteAt >= 0 ? args[siteAt + 1] : null;
  const distArg = args.find((a, i) => !a.startsWith('--') && i !== siteAt + 1);
  const dist = resolve(process.cwd(), distArg ?? 'dist');
  const site = sitePath ? JSON.parse(readFileSync(resolve(process.cwd(), sitePath), 'utf-8')) : null;
  const installable = site?.devices?.installable === true;
  const viewports = devicesFor(site).flatMap((d) => DEVICE_VIEWPORTS[d] ?? []);

  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.error('luhtech-device-smoke needs Playwright: npm i -D playwright && npx playwright install chromium');
    process.exitCode = 2;
    return;
  }

  const files = htmlFiles(dist);
  const server = await serve(dist);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await playwright.chromium.launch();
  let errorCount = 0;
  try {
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        deviceScaleFactor: vp.deviceScaleFactor,
      });
      const page = await context.newPage();
      for (const file of files) {
        const rel = relative(dist, file);
        const path = '/' + rel.replace(/index\.html$/, '').replace(/\\/g, '/');
        const problems = [];
        await page.goto(origin + path, { waitUntil: 'load' });
        const r = await page.evaluate(() => {
          const visible = (el) => {
            const b = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
          };
          const header = document.querySelector('header');
          return {
            viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? null,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            navReachable: header
              ? [...header.querySelectorAll('a[href], button')].some(visible)
              : false,
          };
        });
        problems.push(...viewportProblems(r.viewport));
        if (r.scrollWidth > r.innerWidth + 1) {
          problems.push(`page is ${r.scrollWidth}px wide on a ${r.innerWidth}px screen`);
        }
        if (!r.navReachable) problems.push('no visible header link or menu button');
        if (installable) problems.push(...installProblems(readFileSync(file, 'utf-8')));
        if (problems.length) {
          console.log(`${rel} @ ${vp.label} ${vp.width}x${vp.height}`);
          for (const p of problems) console.log(`  error: ${p}`);
          errorCount += problems.length;
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(
    `\n${files.length} pages x ${viewports.length} viewports (${viewports.map((v) => v.label).join(', ')}): ${errorCount} errors.`
  );
  if (errorCount > 0) process.exitCode = 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
