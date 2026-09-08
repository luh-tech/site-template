import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findViolations, buildProhibitedTerms, collectTextFields } from '../bin/luhtech-page-lexicon.mjs';

test('findViolations: whole-word, case-insensitive, multi-word phrase', () => {
  assert.deepEqual(findViolations('This forks Ectropy internally', ['forks Ectropy']), ['forks Ectropy']);
  assert.deepEqual(findViolations('FORKS ECTROPY', ['forks ectropy']), ['forks ectropy']);
  assert.deepEqual(findViolations('a forklift', ['fork']), []); // whole-word: "fork" must not match inside "forklift"
});

test('findViolations: strips markdown before matching', () => {
  assert.deepEqual(findViolations('a [DAO](https://example.com) reference', ['DAO']), ['DAO']);
  assert.deepEqual(findViolations('**DAO** in bold', ['DAO']), ['DAO']);
});

test('buildProhibitedTerms: drops the current brand\'s own name even when it comes from luhtechBrand\'s list', () => {
  // Regression test: LuhTech-Business's own prohibited list legitimately
  // names every OTHER venture as a sibling -- including, from its own
  // perspective, the venture whose page is being checked right now. Found
  // live during C1 smoke-testing: checking Replique's page against
  // Replique's own brand (correctly excludes "Replique") merged with
  // LuhTech-Business's brand (which legitimately includes "Replique" as
  // one of its 9 siblings) produced a false-positive violation on
  // Replique's own name before this fix.
  const repliqueBrand = {
    brandId: 'replique',
    identity: { name: 'Replique' },
    voice: { lexicon: { prohibited: ['DAO', 'LuhTech', 'Ectropy'] } }, // correctly excludes itself
  };
  const luhtechBrand = {
    brandId: 'luhtech-business',
    identity: { name: 'LuhTech' },
    voice: { lexicon: { prohibited: ['DAO', 'Ectropy', 'Replique', 'Qullqa'] } }, // includes Replique (sibling from LuhTech's view)
  };
  const terms = buildProhibitedTerms(repliqueBrand, luhtechBrand);
  assert.ok(!terms.has('Replique'), '"Replique" must be dropped -- it is the current brand\'s own name');
  assert.ok(![...terms].some((t) => t.toLowerCase() === 'replique'));
  assert.ok(terms.has('DAO'));
  assert.ok(terms.has('Ectropy'));
  assert.ok(terms.has('Qullqa'));
});

test('collectTextFields: excludes crossLinks relationshipLine (the schema-legal sibling-mention carve-out)', () => {
  const page = {
    seo: { title: 'T', description: 'D' },
    sections: [
      {
        sectionId: 'open',
        sectionKind: 'open',
        blocks: [{ blockType: 'paragraph', text: 'body text' }],
        crossLinks: [{ brandRef: 'ohjaus', relationshipLine: 'Ohjaus supplies sensing.', href: 'https://ohjaus.ai' }],
      },
    ],
  };
  const fields = collectTextFields(page);
  const paths = fields.map((f) => f.path);
  assert.ok(!paths.some((p) => p.includes('crossLinks')), 'crossLinks fields must never be collected for lexicon checking');
});
