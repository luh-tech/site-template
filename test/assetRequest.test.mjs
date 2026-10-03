import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assetRequestBody,
  contentRequestBody,
  referredByCodeFrom,
  requestEndpointFor,
  sourceRefFor,
  utmFromSearch,
} from '../src/lib/assetRequest.ts';

// d-2026-10-01-st-asset-request-form: the body the gated asset form posts to
// the capture service, shaped to its validators.

const input = {
  firstName: ' Jane ', lastName: 'Prospect', email: 'jane@acme.com', company: 'Acme',
  persona: 'gc', seriesOptIn: false, discuss: false, answer: '',
};
const ctx = { assetRef: 'the-unshared-record-pdf', search: '?utm_source=linkedin&utm_medium=organic&utm_campaign=unshared-record&src=post:li-7381&x=1', pathname: '/insights/the-unshared-record/', ventureRef: 'luhtech' };

test('utm keeps the five standard keys, renamed', () => {
  assert.deepEqual(utmFromSearch(ctx.search), { source: 'linkedin', medium: 'organic', campaign: 'unshared-record' });
  assert.equal(utmFromSearch('?x=1'), undefined);
});

test('sourceRef is the post the link carries, else this page', () => {
  assert.equal(sourceRefFor(ctx.search, ctx.pathname), 'post:li-7381');
  assert.equal(sourceRefFor('', '/insights/the-unshared-record/'), 'page:the-unshared-record');
  assert.equal(sourceRefFor('?src=tweet:1', '/insights/x/'), 'page:x');
  assert.equal(sourceRefFor('', '/'), 'page:home');
});

test('the asset request carries assetRef, sourceRef, persona, utm and the trimmed contact, opt-in unticked by default', () => {
  const body = assetRequestBody(input, ctx);
  assert.equal(body.assetRef, 'the-unshared-record-pdf');
  assert.equal(body.sourceRef, 'post:li-7381');
  assert.equal(body.persona, 'gc');
  assert.equal(body.seriesOptIn, false);
  assert.deepEqual(body.contact, { firstName: 'Jane', lastName: 'Prospect', email: 'jane@acme.com', company: 'Acme' });
  assert.ok(!('link' in body));
});

test('an unknown persona falls back to unclassified', () => {
  assert.equal(assetRequestBody({ ...input, persona: 'investor' }, ctx).persona, 'unclassified');
});

test('no request unless "discuss with us" is ticked; then a whitepaper request with the answer', () => {
  assert.equal(contentRequestBody(input, ctx), null);
  const req = contentRequestBody({ ...input, discuss: true, answer: ' Our specs live in five places. ' }, ctx);
  assert.equal(req.requestKind, 'whitepaper');
  assert.equal(req.message, 'Our specs live in five places.');
  assert.ok(!('seriesOptIn' in req));
  assert.equal(req.assetRef, 'the-unshared-record-pdf');
});

test('the requests endpoint sits beside the assets endpoint', () => {
  assert.equal(requestEndpointFor('https://api.luh.tech/api/tools/submissions/assets'), 'https://api.luh.tech/api/tools/submissions/requests');
});

test('a code arrival names its code as referredByCode; no code, or a malformed one, sends none (d-2026-10-02-st-paper-landing-three-actions)', () => {
  const coded = assetRequestBody(input, { ...ctx, search: '?c=Ab3_x-9Q', pathname: '/papers/the-unshared-record/' });
  assert.equal(coded.referredByCode, 'Ab3_x-9Q');
  assert.equal(coded.sourceRef, 'page:the-unshared-record');
  assert.ok(!('utm' in coded));
  assert.ok(!('referredByCode' in assetRequestBody(input, ctx)));
  assert.ok(!('referredByCode' in assetRequestBody(input, { ...ctx, search: '?c=a b' })));
  assert.equal(referredByCodeFrom('?c=abc'), undefined);
});
