import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fetchSchema, fetchSupportSchema } from './schemaFetch.js';

const BRAND_PIN = '1.3.0';

let validatorPromise: ReturnType<typeof buildValidator> | null = null;

async function buildValidator() {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);

  const [brandSchema, definitionsSchema, graphSchema, ventureEnum, luhtechEnums] =
    await Promise.all([
      fetchSchema('portfolio/brand-identity.schema.json', BRAND_PIN),
      fetchSupportSchema('_definitions/definitions.schema.json'),
      fetchSupportSchema('_definitions/graph.schema.json'),
      fetchSupportSchema('_enums/venture.enum.json'),
      fetchSupportSchema('_enums/luhtech-enums.schema.v2.json'),
    ]);

  ajv.addSchema(definitionsSchema as object);
  ajv.addSchema(graphSchema as object);
  ajv.addSchema(ventureEnum as object);
  ajv.addSchema(luhtechEnums as object);

  return ajv.compile(brandSchema as object);
}

export interface LoadedBrand {
  brandId: string;
  identity: { name: string; tagline?: string; oneLiner: string; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Reads a portfolio/brand-identity.schema.json instance from disk and
 * ajv-validates it against the pinned live schema (+ its real $ref chain).
 * Mirrors loadPage/loadSite -- throws on validation failure rather than
 * returning an unvalidated instance.
 */
export async function loadBrand(path: string): Promise<LoadedBrand> {
  const raw = readFileSync(path, 'utf-8');
  const instance = JSON.parse(raw);

  if (!validatorPromise) validatorPromise = buildValidator();
  const validate = await validatorPromise;

  if (!validate(instance)) {
    const errors = (validate.errors ?? [])
      .map((e) => `  ${e.instancePath || '/'} ${e.message}`)
      .join('\n');
    throw new Error(
      `${path} failed portfolio/brand-identity.schema.json@${BRAND_PIN} validation:\n${errors}`
    );
  }

  return instance as LoadedBrand;
}
