#!/usr/bin/env node
/**
 * Checks every built HTML page under a site's dist/ for the browser and
 * search metadata SiteLayout is expected to emit. Run after `astro build`.
 *
 * Errors (exit 1): missing <title>, meta description, canonical link,
 * icon link, og:image, or <html lang>.
 * Warnings (exit 0): title over 60 characters, description outside
 * 70-160 characters, anything other than exactly one <h1>. These are
 * content edits (page.seo / brand identity), reported so they are seen,
 * not so they block a build.
 *
 * Usage: luhtech-seo-check [dist-dir]   (default: dist)
 */
import { readFileSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 70;
export const DESCRIPTION_MAX = 160;

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function metaContent(html, attr, value) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (new RegExp(`${attr}=["']${value}["']`, 'i').test(tag)) {
      const m = tag.match(/content=["']([^"']*)["']/i);
      return m ? decode(m[1]) : '';
    }
  }
  return null;
}

function hasLinkRel(html, rel) {
  return (html.match(/<link\b[^>]*>/gi) ?? []).some((tag) =>
    new RegExp(`rel=["'][^"']*\\b${rel}\\b[^"']*["']`, 'i').test(tag)
  );
}

export function checkHtml(html) {
  const errors = [];
  const warnings = [];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const description = metaContent(html, 'name', 'description');

  if (!title) errors.push('missing <title>');
  else if (decode(title).length > TITLE_MAX) warnings.push(`title is ${decode(title).length} characters (over ${TITLE_MAX})`);
  if (!description) errors.push('missing meta description');
  else if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX)
    warnings.push(`description is ${description.length} characters (aim ${DESCRIPTION_MIN}-${DESCRIPTION_MAX})`);
  if (!hasLinkRel(html, 'canonical')) errors.push('missing canonical link');
  if (!hasLinkRel(html, 'icon')) errors.push('missing icon link');
  if (metaContent(html, 'property', 'og:image') === null) errors.push('missing og:image');
  if (!/<html\b[^>]*\blang=["'][^"']+["']/i.test(html)) errors.push('missing <html lang>');
  const h1 = (html.match(/<h1\b/gi) ?? []).length;
  if (h1 !== 1) warnings.push(`${h1} <h1> headings (expected 1)`);
  return { errors, warnings };
}

export function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...htmlFiles(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

function main() {
  const dist = resolve(process.cwd(), process.argv[2] ?? 'dist');
  const files = htmlFiles(dist);
  let errorCount = 0;
  let warningCount = 0;
  for (const file of files) {
    const { errors, warnings } = checkHtml(readFileSync(file, 'utf-8'));
    if (!errors.length && !warnings.length) continue;
    console.log(relative(dist, file));
    for (const e of errors) console.log(`  error: ${e}`);
    for (const w of warnings) console.log(`  warning: ${w}`);
    errorCount += errors.length;
    warningCount += warnings.length;
  }
  console.log(`\n${files.length} pages checked: ${errorCount} errors, ${warningCount} warnings.`);
  if (errorCount > 0) process.exitCode = 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
