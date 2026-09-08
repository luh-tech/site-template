// Fetches the live, version-pinned schemas this package validates against.
// Pins live in package.json's luhtech.schemaPins -- the immutable
// https://schemas.luh.tech/v/{version}/{path} convention (d-2026-08-28-eb-
// versioned-schema-serving), not the floating "latest" alias, so a schema
// change upstream never silently changes what an already-shipped site
// build validates against.
//
// content/capability-claim.schema.json is a known, flagged gap: it 404s at
// both its bare and versioned live URLs (a schema-registry publish-pipeline
// issue, out of scope for this package -- see the site-template README).
// This loader falls back to a vendored local copy for that one schema only,
// fetched from the real schema-registry source (not fabricated), and never
// silently swallows a 404 for any other schema.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const VENDORED_FALLBACK: Record<string, string> = {
  'content/capability-claim.schema.json': join(
    __dirname,
    '_vendored-schema-fallback/capability-claim.schema.json'
  ),
};

const cache = new Map<string, unknown>();

export async function fetchSchema(pinnedPath: string, version: string): Promise<unknown> {
  const cacheKey = `${pinnedPath}@${version}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `https://schemas.luh.tech/v/${version}/${pinnedPath}`;
  let schema: unknown;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    schema = await res.json();
  } catch (err) {
    const fallback = VENDORED_FALLBACK[pinnedPath];
    if (!fallback) {
      throw new Error(
        `Failed to fetch pinned schema ${pinnedPath}@${version} from ${url}: ${(err as Error).message}. ` +
          `No vendored fallback exists for this schema -- this is a real failure, not a known gap.`
      );
    }
    console.warn(
      `[site-template] ${pinnedPath}@${version} unreachable at ${url} (known publish-pipeline gap) -- using vendored fallback.`
    );
    schema = JSON.parse(readFileSync(fallback, 'utf-8'));
  }
  cache.set(cacheKey, schema);
  return schema;
}

/** Unversioned support schemas (definitions, enums) the pinned schemas $ref -- these
 *  are stable, shared vocabulary, not independently versioned/pinned. */
export async function fetchSupportSchema(path: string): Promise<unknown> {
  const cacheKey = `support:${path}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const url = `https://schemas.luh.tech/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch support schema ${path} from ${url}: HTTP ${res.status}`);
  }
  const schema = await res.json();
  cache.set(cacheKey, schema);
  return schema;
}
