// d-2026-10-02-st-paper-landing-three-actions: the paper's one page
// (/papers/<slug>/) -- its open summary and figures, then Download, Feedback
// and Share. It reads the whitepaper record (schema-registry
// content/whitepaper.schema.json 1.3.0). Pure, so the page's script and the
// tests share one implementation.

/** Whitepaper statuses that put a paper's page on the site (L4 approves the final paper first). */
export const PAPER_LIVE_STATUSES = ['APPROVED', 'COMPLETE'] as const;

export function isPaperLive(status: unknown): boolean {
  return (PAPER_LIVE_STATUSES as readonly unknown[]).includes(status);
}

/** The gateway's delivery token (tool-submission.routes.ts GET /assets/:token). */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** A printed or forwarded copy's code (business-tools link-codes.ts CODE_PATTERN). */
export const CODE_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

export type Arrival = { by: 'token'; token: string } | { by: 'code'; code: string } | { by: 'none' };

/**
 * How the visitor arrived: ?t=<token> from the delivery email, ?c=<code> from
 * a scanned or forwarded copy, else neither. A malformed value counts as none.
 */
export function arrivalFrom(search: string): Arrival {
  const params = new URLSearchParams(search);
  const t = params.get('t');
  if (t && TOKEN_PATTERN.test(t)) return { by: 'token', token: t };
  const c = params.get('c');
  if (c && CODE_PATTERN.test(c)) return { by: 'code', code: c };
  return { by: 'none' };
}

/** The gateway's download route beside the asset request endpoint the site config names. */
export function downloadUrlFor(assetRequestEndpoint: string, token: string): string {
  return `${assetRequestEndpoint.replace(/\/+$/, '')}/${encodeURIComponent(token)}`;
}

/** The non-personal link to share: the page URL with no query and no fragment, so never a token or code. */
export function shareUrlFor(pageUrl: string): string {
  const u = new URL(pageUrl);
  return `${u.origin}${u.pathname}`;
}

export function linkedInShareUrl(shareUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
}

export function mailtoShareUrl(shareUrl: string, title: string): string {
  return `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareUrl)}`;
}

/** The Feedback form is open only when the site config names both its endpoint and its Turnstile site key. */
export function feedbackOpen(leadCapture: { feedbackEndpoint?: string; turnstileSiteKey?: string } | undefined): boolean {
  return Boolean(leadCapture?.feedbackEndpoint && leadCapture?.turnstileSiteKey);
}

export interface FeedbackInput {
  roleId: string;
  answers: Record<string, string>;
  publishConsent: boolean;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  turnstileToken: string;
}

/**
 * The body business-tools POST /api/public/papers/feedback takes
 * (apps/dashboard/src/lib/paper-feedback.ts parseSubmission): answers keyed by
 * questionId (blank ones left out), the role, the consent box, how the reader
 * arrived (a code arrival names its code), name and email on both arrivals,
 * and the Turnstile token. Null when the reader arrived by neither.
 */
export function feedbackBody(input: FeedbackInput, ctx: { assetRef: string; arrival: Arrival; sourceRef?: string }) {
  if (ctx.arrival.by === 'none') return null;
  const answers: Record<string, string> = {};
  for (const [questionId, value] of Object.entries(input.answers)) {
    const v = String(value ?? '').trim();
    if (v) answers[questionId] = v.slice(0, 4000);
  }
  return {
    assetRef: ctx.assetRef,
    roleId: input.roleId,
    answers,
    publishConsent: input.publishConsent === true,
    arrivedBy: ctx.arrival.by,
    ...(ctx.arrival.by === 'code' ? { code: ctx.arrival.code } : {}),
    ...(ctx.sourceRef ? { sourceRef: ctx.sourceRef } : {}),
    contact: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim(),
      ...(input.company?.trim() ? { company: input.company.trim() } : {}),
    },
    turnstileToken: input.turnstileToken,
  };
}

/** What the reader is told for each answer the feedback endpoint can give. */
export function feedbackMessage(status: number, error?: string): string {
  if (status === 201) return 'Thank you -- your answers reached us.';
  if (status === 503) return 'Feedback is not open yet.';
  if (status === 429) return 'Too many submissions from here; try again in an hour.';
  if (status === 403) return 'The challenge did not pass; reload the page and try again.';
  if (status === 400 && error) return error;
  return 'Something went wrong. Try again in a moment.';
}

interface PaperFigure {
  figureId: string;
  value: string;
  unit?: string;
  caption?: string;
  estimate?: boolean;
  provenance: { sourceRef: string; public: boolean; observedAt?: string };
}

export interface PaperRecord {
  title: string;
  subtitle?: string;
  summary: string;
  status: string;
  figures?: PaperFigure[];
  openFigureIds?: string[];
  pdfAssetRef?: string;
  feedbackForm?: {
    roles: { roleId: string; label: string; persona?: string }[];
    questions: { questionId: string; prompt: string; answerType: 'text' | 'choice'; choices?: { choiceId: string; label: string }[]; allowOther?: boolean }[];
  };
  [key: string]: unknown;
}

/**
 * The paper's open summary and figures as page sections, so the page renders
 * them through the same section components as the landing page it replaces
 * (d-2026-10-01-eb-whitepaper-hybrid-gate): a hero with the summary's first
 * paragraph, a summary section with the rest, and the open figures with
 * their captions.
 */
export function paperSections(paper: PaperRecord, slug: string) {
  const paragraphs = paper.summary.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const [lede, ...rest] = paragraphs;
  const open = (paper.openFigureIds ?? []).map((id) => {
    const f = (paper.figures ?? []).find((x) => x.figureId === id);
    if (!f) throw new Error(`paper ${slug}: openFigureIds names ${id}, which is not in figures[]`);
    return f;
  });
  const sections: Record<string, unknown>[] = [
    {
      sectionId: slug,
      sectionKind: 'hero',
      heading: paper.title,
      ...(paper.subtitle ? { subheading: paper.subtitle } : {}),
      ...(lede ? { blocks: [{ blockType: 'lede', text: lede }] } : {}),
    },
  ];
  if (rest.length) {
    sections.push({
      sectionId: `${slug}-summary`,
      sectionKind: 'approach',
      heading: 'Summary',
      blocks: rest.map((text) => ({ blockType: 'paragraph', text })),
    });
  }
  if (open.length) {
    sections.push({
      sectionId: `${slug}-figures`,
      sectionKind: 'proof',
      heading: 'What the paper finds',
      blocks: open.filter((f) => f.caption).map((f) => ({ blockType: 'paragraph', text: f.caption })),
      figures: open.map((f) => ({
        figureId: f.figureId,
        value: f.estimate && !/estimate/i.test(f.value) ? `${f.value} (estimate)` : f.value,
        ...(f.unit ? { unit: f.unit } : {}),
        provenance: f.provenance,
      })),
    });
  }
  return sections;
}
