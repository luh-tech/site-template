import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  arrivalFrom,
  downloadUrlFor,
  feedbackBody,
  feedbackMessage,
  feedbackOpen,
  isPaperLive,
  linkedInShareUrl,
  mailtoShareUrl,
  paperSections,
  shareUrlFor,
} from '../src/lib/paperLanding.ts';

// d-2026-10-02-st-paper-landing-three-actions: the paper's one page.

const TOKEN = 'A'.repeat(20) + '_-' + 'b'.repeat(21); // 43 characters, the gateway's token shape
const paper = {
  title: 'The Unshared Record',
  subtitle: 'A subtitle',
  status: 'APPROVED',
  summary: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
  pdfAssetRef: 'the-unshared-record-pdf',
  openFigureIds: ['rework-pool-2025', 'rfi-median-days'],
  figures: [
    { figureId: 'rfi-median-days', value: '9.7 days', evidenceTag: 'CITED', caption: 'median RFI response time', provenance: { sourceRef: 'Navigant Construction Forum, 2013', public: true } },
    { figureId: 'rework-pool-2025', value: '$52 billion', evidenceTag: 'INFERRED', estimate: true, caption: 'rework a year', provenance: { sourceRef: "The paper's own scaling", public: true } },
    { figureId: 'closed-figure', value: '1', evidenceTag: 'CITED', provenance: { sourceRef: 'x', public: true } },
  ],
  feedbackForm: {
    roles: [{ roleId: 'owner', label: 'Owner', persona: 'owner' }],
    questions: [{ questionId: 'costliest-handoff', prompt: 'Which handoff costs your organization the most today?', answerType: 'text', askedInDelivery: true }],
  },
};

test('only an APPROVED or COMPLETE paper has a page', () => {
  assert.equal(isPaperLive('APPROVED'), true);
  assert.equal(isPaperLive('COMPLETE'), true);
  for (const s of ['DRAFT', 'PROPOSED', 'SUPERSEDED', undefined, 'approved']) assert.equal(isPaperLive(s), false);
});

test('arrival: a token from the email, else a code from a copy, else none', () => {
  assert.deepEqual(arrivalFrom(`?t=${TOKEN}`), { by: 'token', token: TOKEN });
  assert.deepEqual(arrivalFrom(`?t=${TOKEN}&c=Ab3_x-9Q`), { by: 'token', token: TOKEN });
  assert.deepEqual(arrivalFrom('?c=Ab3_x-9Q'), { by: 'code', code: 'Ab3_x-9Q' });
  assert.deepEqual(arrivalFrom('?t=short'), { by: 'none' });
  assert.deepEqual(arrivalFrom(''), { by: 'none' });
});

test('download with a token opens the gateway download route beside the asset request endpoint', () => {
  assert.equal(
    downloadUrlFor('https://ectropy.ai/api/tools/submissions/assets', TOKEN),
    `https://ectropy.ai/api/tools/submissions/assets/${TOKEN}`
  );
  assert.equal(downloadUrlFor('https://x.test/assets/', TOKEN), `https://x.test/assets/${TOKEN}`);
});

test('share never carries the token or the code, nor the #feedback fragment', () => {
  const url = shareUrlFor(`https://luh.tech/papers/the-unshared-record/?t=${TOKEN}&c=Ab3_x-9Q&utm_source=x#feedback`);
  assert.equal(url, 'https://luh.tech/papers/the-unshared-record/');
  assert.equal(linkedInShareUrl(url), 'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fluh.tech%2Fpapers%2Fthe-unshared-record%2F');
  const mail = mailtoShareUrl(url, 'The Unshared Record');
  assert.ok(mail.startsWith('mailto:?subject=The%20Unshared%20Record&body='));
  for (const s of [url, linkedInShareUrl(url), mail]) {
    assert.ok(!s.includes(TOKEN) && !s.includes('Ab3_x-9Q'));
  }
});

test('feedback is open only when site config names both the endpoint and the Turnstile site key', () => {
  assert.equal(feedbackOpen({ feedbackEndpoint: 'https://dash.luh.tech/api/public/papers/feedback', turnstileSiteKey: '0x4AAAAAAA' }), true);
  assert.equal(feedbackOpen({ feedbackEndpoint: 'https://dash.luh.tech/api/public/papers/feedback' }), false);
  assert.equal(feedbackOpen(undefined), false);
});

test('feedback body: answers keyed by questionId, contact on both arrivals, the code on a code arrival', () => {
  const input = {
    roleId: 'owner', answers: { 'costliest-handoff': ' Design to fabrication. ', 'build-first': '  ' },
    publishConsent: false, firstName: ' Jane ', lastName: 'Reader', email: 'jane@acme.com', company: '', turnstileToken: 'tt',
  };
  const byToken = feedbackBody(input, { assetRef: 'the-unshared-record-pdf', arrival: { by: 'token', token: TOKEN }, sourceRef: 'page:the-unshared-record' });
  assert.deepEqual(byToken, {
    assetRef: 'the-unshared-record-pdf', roleId: 'owner', answers: { 'costliest-handoff': 'Design to fabrication.' },
    publishConsent: false, arrivedBy: 'token', sourceRef: 'page:the-unshared-record',
    contact: { firstName: 'Jane', lastName: 'Reader', email: 'jane@acme.com' }, turnstileToken: 'tt',
  });
  assert.ok(!JSON.stringify(byToken).includes(TOKEN), 'the token is never posted to the feedback endpoint');
  const byCode = feedbackBody(input, { assetRef: 'the-unshared-record-pdf', arrival: { by: 'code', code: 'Ab3_x-9Q' } });
  assert.equal(byCode.arrivedBy, 'code');
  assert.equal(byCode.code, 'Ab3_x-9Q');
  assert.equal(feedbackBody(input, { assetRef: 'x', arrival: { by: 'none' } }), null);
});

test('a closed endpoint (503) reads as not open yet', () => {
  assert.equal(feedbackMessage(503), 'Feedback is not open yet.');
  assert.equal(feedbackMessage(400, 'answer at least one question'), 'answer at least one question');
  assert.match(feedbackMessage(201), /Thank you/);
});

test('the record becomes the summary and open-figure sections, figures in openFigureIds order, estimates labelled', () => {
  const [hero, summary, figures, ...rest] = paperSections(paper, 'the-unshared-record');
  assert.equal(rest.length, 0);
  assert.deepEqual(hero, { sectionId: 'the-unshared-record', sectionKind: 'hero', heading: 'The Unshared Record', subheading: 'A subtitle', blocks: [{ blockType: 'lede', text: 'First paragraph.' }] });
  assert.deepEqual(summary.blocks.map((b) => b.text), ['Second paragraph.', 'Third paragraph.']);
  assert.equal(figures.sectionKind, 'proof');
  assert.deepEqual(figures.figures.map((f) => [f.figureId, f.value]), [['rework-pool-2025', '$52 billion (estimate)'], ['rfi-median-days', '9.7 days']]);
  assert.deepEqual(figures.blocks.map((b) => b.text), ['rework a year', 'median RFI response time']);
});

test('an open figure missing from figures[] fails the build', () => {
  assert.throws(() => paperSections({ ...paper, openFigureIds: ['nope'] }, 's'), /nope/);
});

test('the page holds no endpoint of its own: every endpoint comes from site config', () => {
  const src = readFileSync(new URL('../src/components/PaperLanding.astro', import.meta.url), 'utf-8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const urls = code.match(/https:\/\/[^\s'"`)>]+/g) ?? [];
  assert.deepEqual([...new Set(urls)], ['https://challenges.cloudflare.com/turnstile/v0/api.js']);
  assert.ok(!/luh\.tech|ectropy\.ai/.test(code));
});
