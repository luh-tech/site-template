import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fetchSchema, fetchSupportSchema } from './schemaFetch.js';

const TOOL_PIN = '1.2.0';
const CAPABILITY_CLAIM_PIN = '0.2.0';

let validatorPromise: ReturnType<typeof buildValidator> | null = null;

async function buildValidator() {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);

  // tool.schema.json 1.2.0 adopts the content spine (cell refs, themes,
  // strategy) and forbids audit-paint field names, so its $ref chain now
  // reaches cell, content-spine (which itself $refs capability-claim) and
  // forbidden-audit-paint-names -- found building LuhTech-Business's /tools/
  // route against the 1.2.0 pin, which failed "can't resolve reference".
  const [toolSchema, capabilityClaimSchema, definitionsSchema, graphSchema, cellSchema, contentSpineSchema, forbiddenNamesSchema] =
    await Promise.all([
      fetchSchema('content/tool.schema.json', TOOL_PIN),
      fetchSchema('content/capability-claim.schema.json', CAPABILITY_CLAIM_PIN),
      fetchSupportSchema('_definitions/definitions.schema.json'),
      fetchSupportSchema('_definitions/graph.schema.json'),
      fetchSupportSchema('_definitions/cell.schema.json'),
      fetchSupportSchema('_definitions/content-spine.schema.json'),
      fetchSupportSchema('_definitions/forbidden-audit-paint-names.schema.json'),
    ]);

  ajv.addSchema(capabilityClaimSchema as object);
  ajv.addSchema(definitionsSchema as object);
  ajv.addSchema(graphSchema as object);
  ajv.addSchema(cellSchema as object);
  ajv.addSchema(contentSpineSchema as object);
  ajv.addSchema(forbiddenNamesSchema as object);

  return ajv.compile(toolSchema as object);
}

export interface ToolFieldSpec {
  id: string;
  label: string;
  type: 'number' | 'currency-usd' | 'percent' | 'integer' | 'string';
  unit?: string;
  min?: number;
  max?: number;
  helpText?: string;
}

export interface ToolMethodNoteSpec {
  tag: string;
  title: string;
  formula?: string;
  body: string;
}

export interface ToolSourceSpec {
  label: string;
  href: string;
}

export interface ToolPresentationSpec {
  heroOutputId?: string;
  disclosure?: string;
  chart?: { xLabel: string; yLabel: string; caption?: string };
  methodNotes?: ToolMethodNoteSpec[];
  sources?: ToolSourceSpec[];
}

export interface LoadedTool {
  toolId: string;
  title: string;
  description?: string;
  computationRef: string;
  inputs: ToolFieldSpec[];
  outputFields: ToolFieldSpec[];
  presentation?: ToolPresentationSpec;
  [key: string]: unknown;
}

/**
 * Reads a content/tool.schema.json instance from disk and ajv-validates it
 * against the pinned live schema (+ its real $ref chain). Throws on any
 * validation failure -- same convention as loadPage/loadSite.
 */
export async function loadTool(path: string): Promise<LoadedTool> {
  const raw = readFileSync(path, 'utf-8');
  const instance = JSON.parse(raw);

  if (!validatorPromise) validatorPromise = buildValidator();
  const validate = await validatorPromise;

  if (!validate(instance)) {
    const errors = (validate.errors ?? [])
      .map((e) => `  ${e.instancePath || '/'} ${e.message}`)
      .join('\n');
    throw new Error(
      `${path} failed content/tool.schema.json@${TOOL_PIN} validation:\n${errors}`
    );
  }

  return instance as LoadedTool;
}
