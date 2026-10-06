import { readFileSync } from 'node:fs';

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
 * Reads a content/tool.schema.json instance from disk. The instance is validated in the
 * site repo's CI against schema-registry (schema-registry content-validate.yml),
 * not here: this public package fetches and carries no schema.
 */
export async function loadTool(path: string): Promise<LoadedTool> {
  const raw = readFileSync(path, 'utf-8');
  const instance = JSON.parse(raw);

  return instance as LoadedTool;
}
