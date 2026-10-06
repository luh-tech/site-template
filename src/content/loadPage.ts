import { readFileSync } from 'node:fs';

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
 * Reads a content/page.schema.json instance from disk. The instance is validated in the
 * site repo's CI against schema-registry (schema-registry content-validate.yml),
 * not here: this public package fetches and carries no schema.
 */
export async function loadPage(path: string): Promise<LoadedPage> {
  const raw = readFileSync(path, 'utf-8');
  const instance = JSON.parse(raw);

  return instance as LoadedPage;
}
