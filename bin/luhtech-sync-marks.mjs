#!/usr/bin/env node
/**
 * Pulls each real venture's current favicon.svg (its own repo's real,
 * production-serving mark -- not a formally schema-governed asset yet;
 * portfolio/brand-identity.schema.json's logo.requiredVariants only
 * covers the full wordmark, via asset-bank CDN URLs, not this small
 * square glyph) into a consuming site's public/brand/ directory.
 *
 * Built because LuhTech-business's public/brand/*-mark.svg copies had
 * gone stale against 3 of 9 real ventures (Ectropy, JobsiteControl,
 * Viiva each redesigned their own favicon after the last manual copy --
 * JobsiteControl by 4 days, the other two same-day but hours later) --
 * each fix before this was a one-off PR re-copying a single file by
 * hand, which is exactly how it went stale again. This is the repeatable
 * replacement for that manual process.
 *
 * Local dev-time tool only -- reads from sibling repo checkouts on disk
 * (the real venture repos live as siblings under one parent dev
 * directory, e.g. ~/dev/luhtech/<Venture>), so it can't run in CI. Run it
 * by hand when a venture's own favicon changes, or periodically to catch
 * drift, matching this codebase's existing "manual, documented sync"
 * convention (see e.g. business-tools/data/roadmap-cache/cache-manifest.json's
 * syncMethod:"manual" entries) rather than assuming a live cross-repo
 * automation that doesn't exist.
 *
 * Usage:
 *   luhtech-sync-marks <output-dir> [--dev-root <path>] [--dry-run]
 *   luhtech-sync-marks public/brand
 *   luhtech-sync-marks public/brand --dev-root ~/dev/luhtech --dry-run
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { VENTURES } from './lib/ventures.mjs';

const args = process.argv.slice(2);
const outputArg = args.find((a) => !a.startsWith('--'));
const devRootFlagIdx = args.indexOf('--dev-root');
const devRoot = devRootFlagIdx >= 0 ? args[devRootFlagIdx + 1] : join(homedir(), 'dev', 'luhtech');
const dryRun = args.includes('--dry-run');

if (!outputArg) {
  console.error('Usage: luhtech-sync-marks <output-dir> [--dev-root <path>] [--dry-run]');
  process.exit(1);
}
const outputDir = resolve(process.cwd(), outputArg);

function main() {
  mkdirSync(outputDir, { recursive: true });
  let changed = 0;
  let unchanged = 0;
  let missing = 0;

  for (const v of VENTURES) {
    const srcPath = join(devRoot, v.repo, v.favicon);
    const destPath = join(outputDir, `${v.id}-mark.svg`);

    if (!existsSync(srcPath)) {
      console.warn(`  ! ${v.id}: no favicon at ${srcPath} -- skipped`);
      missing++;
      continue;
    }

    const src = readFileSync(srcPath, 'utf-8');
    const existing = existsSync(destPath) ? readFileSync(destPath, 'utf-8') : null;

    if (existing === src) {
      unchanged++;
      continue;
    }

    console.log(`  ${existing === null ? '+' : '~'} ${v.id}: ${srcPath} -> ${destPath}`);
    if (!dryRun) {
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, src, 'utf-8');
    }
    changed++;
  }

  console.log(
    `\n${dryRun ? '[dry run] ' : ''}${changed} updated, ${unchanged} already current, ${missing} source missing.`
  );
  if (missing > 0) process.exitCode = 1;
}

main();
