import { readFileSync } from 'node:fs';

export interface LoadedSite {
  [key: string]: unknown;
}

/**
 * Reads a content/site.schema.json instance from disk. The instance is validated in the
 * site repo's CI against schema-registry (schema-registry content-validate.yml),
 * not here: this public package fetches and carries no schema.
 */
export async function loadSite(path: string): Promise<LoadedSite> {
  const raw = readFileSync(path, 'utf-8');
  const instance = JSON.parse(raw);

  return instance as LoadedSite;
}
