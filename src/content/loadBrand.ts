import { readFileSync } from 'node:fs';

export interface LoadedBrand {
  brandId: string;
  identity: { name: string; tagline?: string; oneLiner: string; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Reads a portfolio/brand-identity.schema.json instance from disk. The instance is validated in the
 * site repo's CI against schema-registry (schema-registry content-validate.yml),
 * not here: this public package fetches and carries no schema.
 */
export async function loadBrand(path: string): Promise<LoadedBrand> {
  const raw = readFileSync(path, 'utf-8');
  const instance = JSON.parse(raw);

  return instance as LoadedBrand;
}
