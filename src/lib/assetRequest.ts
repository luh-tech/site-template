// d-2026-10-01-st-asset-request-form: the request a gated asset form sends
// to the capture service (Ectropy-Business POST /api/tools/submissions/assets
// and /requests, d-2026-10-01-eb-capture-service-assets-and-requests). Pure,
// so the form's script and the tests share one implementation.

/** Persona values the form offers (crm/persona-classification plus the form default). */
export const PERSONAS = [
  { value: 'unclassified', label: 'Prefer not to say' },
  { value: 'owner', label: 'Owner or developer' },
  { value: 'gc', label: 'General contractor' },
  { value: 'architect', label: 'Architect or engineer' },
  { value: 'sub', label: 'Specialty contractor' },
  { value: 'super', label: 'Superintendent' },
  { value: 'gov', label: 'Public agency' },
] as const;

const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const;
const SOURCE_REF = /^(article:[a-z0-9]+(-[a-z0-9]+)*|post:[A-Za-z0-9:_-]+|page:[a-z0-9]+(-[a-z0-9]+)*)$/;

/** utm_source=... -> { source: ... }, the five standard keys only. */
export function utmFromSearch(search: string): Record<string, string> | undefined {
  const params = new URLSearchParams(search);
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(`utm_${k}`);
    if (v) utm[k] = v.slice(0, 200);
  }
  return Object.keys(utm).length ? utm : undefined;
}

/**
 * Where the visitor came from: an explicit ?src=post:<id> or article:<slug>
 * the post's own link carries, else this page (page:<last path segment>).
 */
export function sourceRefFor(search: string, pathname: string): string {
  const src = new URLSearchParams(search).get('src');
  if (src && SOURCE_REF.test(src)) return src;
  const slug = pathname.split('/').filter(Boolean).pop() ?? 'home';
  const pageRef = `page:${slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'home'}`;
  return SOURCE_REF.test(pageRef) ? pageRef : 'page:home';
}

/** The /requests endpoint beside the /assets endpoint the site config names. */
export function requestEndpointFor(assetRequestEndpoint: string): string {
  return assetRequestEndpoint.replace(/\/assets\/?$/, '/requests');
}

export interface AssetFormInput {
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  persona: string;
  seriesOptIn: boolean;
  discuss: boolean;
  answer?: string;
}

export interface AssetContext {
  assetRef: string;
  search: string;
  pathname: string;
  ventureRef?: string;
}

/** The asset request body. */
export function assetRequestBody(input: AssetFormInput, ctx: AssetContext) {
  const utm = utmFromSearch(ctx.search);
  return {
    assetRef: ctx.assetRef,
    sourceRef: sourceRefFor(ctx.search, ctx.pathname),
    route: ctx.pathname,
    ...(ctx.ventureRef ? { ventureRef: ctx.ventureRef } : {}),
    persona: PERSONAS.some((p) => p.value === input.persona) ? input.persona : 'unclassified',
    seriesOptIn: input.seriesOptIn === true,
    ...(utm ? { utm } : {}),
    contact: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim(),
      ...(input.company?.trim() ? { company: input.company.trim() } : {}),
    },
  };
}

/** The request body when the visitor ticks "discuss this with us" -- null when they do not. */
export function contentRequestBody(input: AssetFormInput, ctx: AssetContext) {
  if (!input.discuss) return null;
  const asset = assetRequestBody(input, ctx);
  const { seriesOptIn: _optIn, ...rest } = asset;
  return {
    ...rest,
    requestKind: 'whitepaper' as const,
    ...(input.answer?.trim() ? { message: input.answer.trim().slice(0, 4000) } : {}),
  };
}
