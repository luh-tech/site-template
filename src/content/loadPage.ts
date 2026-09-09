import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fetchSchema, fetchSupportSchema } from './schemaFetch.js';

const PAGE_PIN = '1.3.0';
const CAPABILITY_CLAIM_PIN = '0.2.0';

let validatorPromise: ReturnType<typeof buildValidator> | null = null;

async function buildValidator() {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);

  const [pageSchema, capabilityClaimSchema, cellSchema, definitionsSchema, graphSchema, ventureEnum] =
    await Promise.all([
      fetchSchema('content/page.schema.json', PAGE_PIN),
      fetchSchema('content/capability-claim.schema.json', CAPABILITY_CLAIM_PIN),
      fetchSupportSchema('_definitions/cell.schema.json'),
      fetchSupportSchema('_definitions/definitions.schema.json'),
      fetchSupportSchema('_definitions/graph.schema.json'),
      fetchSupportSchema('_enums/venture.enum.json'),
    ]);

  ajv.addSchema(capabilityClaimSchema as object);
  ajv.addSchema(cellSchema as object);
  ajv.addSchema(definitionsSchema as object);
  ajv.addSchema(graphSchema as object);
  ajv.addSchema(ventureEnum as object);

  return ajv.compile(pageSchema as object);
}

export interface PageBlock {
  blockType: string;
  // Required for the text kinds (paragraph/lede/pullquote/list/definition/
  // caption/stat/close); not used by diagram/image, same conditional
  // requirement as the schema's own allOf/if/then -- typed optional here so
  // a real diagram/image block literal (no text) isn't a type error.
  text?: string;
  label?: string;
  href?: string;
  diagramId?: string;
  src?: string;
  alt?: string;
  caption?: string;
}

export interface PageClaim {
  claimId: string;
  kind: string;
  text: string;
  featureRef?: string;
  sourcedStatus?: string;
}

export interface PageCta {
  label: string;
  href: string;
  intent: string;
}

export interface PageCrossLink {
  brandRef: string;
  relationshipLine: string;
  href: string;
}

export interface PageDiagram {
  diagramId: string;
  diagramType: string;
  caption?: string;
  data: unknown;
}

export interface PageSection {
  sectionId: string;
  sectionKind: string;
  heading?: string;
  subheading?: string;
  eyebrow?: string;
  blocks?: PageBlock[];
  claims?: PageClaim[];
  ctas?: PageCta[];
  crossLinks?: PageCrossLink[];
  figures?: unknown[];
  diagrams?: PageDiagram[];
  toolRef?: string;
  [key: string]: unknown;
}

/**
 * `sections` is typed as a real array (not the bare index signature's
 * `unknown`) so a consumer's `page.sections.map(...)` typechecks without
 * a local cast -- found live migrating Ectropy/JobsiteControl/Qullqa/
 * Siltana to this package: `astro check` failed ts(18046) on every one
 * of them ("'page.sections' is of type 'unknown'"), each independently
 * patched with its own `(s: any)` workaround before this fix landed.
 * Other top-level fields stay on the index signature -- only the one
 * every consumer actually iterates gets a real type.
 */
export interface LoadedPage {
  sections: PageSection[];
  [key: string]: unknown;
}

/**
 * Reads a content/page.schema.json instance from disk and ajv-validates it
 * against the pinned live schema (+ its real $ref chain). Throws on any
 * validation failure -- callers should let this fail the build, not catch
 * and continue with an unvalidated instance.
 */
export async function loadPage(path: string): Promise<LoadedPage> {
  const raw = readFileSync(path, 'utf-8');
  const instance = JSON.parse(raw);

  if (!validatorPromise) validatorPromise = buildValidator();
  const validate = await validatorPromise;

  if (!validate(instance)) {
    const errors = (validate.errors ?? [])
      .map((e) => `  ${e.instancePath || '/'} ${e.message}`)
      .join('\n');
    throw new Error(
      `${path} failed content/page.schema.json@${PAGE_PIN} validation:\n${errors}`
    );
  }

  return instance as LoadedPage;
}
