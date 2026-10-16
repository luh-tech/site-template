import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Figure records (schema-registry content/figure) for a page's figureRef diagrams
 * (d-2026-10-16-bt-figure-kit). A site loads its records and builds its brand's theme once, then
 * every diagram that names a figure draws it with @luhtech/figures -- the same SVG the dashboard,
 * a room or a still draws from the same record. Records and the theme are site-wide (one brand per
 * site), so one registry per build is the right scope.
 */
export interface FigureConfig {
  /** figureId -> figure record */
  records: Record<string, any>;
  /** a @luhtech/figures Theme, from buildTheme(brand) */
  theme: any;
}

let config: FigureConfig | null = null;

/** Reads every content/figure instance in `dir`, keyed by figureId. A missing dir is no figures. */
export function loadFigures(dir: string): Record<string, any> {
  if (!existsSync(dir)) return {};
  const out: Record<string, any> = {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const rec = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
    if (out[rec.figureId]) throw new Error(`figureId ${rec.figureId} appears twice in ${dir}`);
    out[rec.figureId] = rec;
  }
  return out;
}

export function configureFigures(c: FigureConfig): void {
  config = c;
}

/** The record and theme a figureRef draws with; a dangling reference is an authoring error. */
export function figureFor(ref: string): { record: any; theme: any } {
  if (!config) throw new Error(`diagram names figure ${ref}, but this site has not called configureFigures()`);
  const record = config.records[ref];
  if (!record) throw new Error(`diagram names figure ${ref}, which is not among this site's figure records`);
  return { record, theme: config.theme };
}
