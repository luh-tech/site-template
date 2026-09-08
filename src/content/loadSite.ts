import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fetchSchema, fetchSupportSchema } from './schemaFetch.js';

const SITE_PIN = '1.0.0';

let validatorPromise: ReturnType<typeof buildValidator> | null = null;

async function buildValidator() {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);

  const [siteSchema, definitionsSchema, graphSchema, ventureEnum] = await Promise.all([
    fetchSchema('content/site.schema.json', SITE_PIN),
    fetchSupportSchema('_definitions/definitions.schema.json'),
    fetchSupportSchema('_definitions/graph.schema.json'),
    fetchSupportSchema('_enums/venture.enum.json'),
  ]);

  ajv.addSchema(definitionsSchema as object);
  ajv.addSchema(graphSchema as object);
  ajv.addSchema(ventureEnum as object);

  return ajv.compile(siteSchema as object);
}

export interface LoadedSite {
  [key: string]: unknown;
}

/**
 * Reads a content/site.schema.json instance from disk and ajv-validates it
 * against the pinned live schema (+ its real $ref chain). Throws on any
 * validation failure -- callers should let this fail the build, not catch
 * and continue with an unvalidated instance.
 */
export async function loadSite(path: string): Promise<LoadedSite> {
  const raw = readFileSync(path, 'utf-8');
  const instance = JSON.parse(raw);

  if (!validatorPromise) validatorPromise = buildValidator();
  const validate = await validatorPromise;

  if (!validate(instance)) {
    const errors = (validate.errors ?? [])
      .map((e) => `  ${e.instancePath || '/'} ${e.message}`)
      .join('\n');
    throw new Error(
      `${path} failed content/site.schema.json@${SITE_PIN} validation:\n${errors}`
    );
  }

  return instance as LoadedSite;
}
