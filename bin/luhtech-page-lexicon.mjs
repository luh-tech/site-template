#!/usr/bin/env node
/**
 * RULE-CONTENT-PAGE-LEXICON-PROHIBITED-1: a page's text-bearing fields must
 * not contain any term from its own brand's voice.lexicon.prohibited[] or
 * from luhtech-business's (the common portfolio-wide list is already merged
 * into every venture's own list by convention, but this checks both
 * explicitly rather than assuming that merge always holds).
 *
 * Whole-word, case-insensitive match, Markdown syntax stripped from the
 * text before matching (so *emphasis* or [links](url) don't themselves
 * trip a match on their own punctuation). crossLinks[].relationshipLine is
 * exempt -- it is the one schema-legal place a sibling brand name may
 * appear (RULE-CONTENT-PAGE-LEXICON-PROHIBITED-1's own carve-out).
 *
 * Usage: luhtech-page-lexicon <path-to-page.json> <path-to-brand-identity.json> [path-to-luhtech-business-brand-identity.json]
 * Exit 0: clean. Exit 1: any prohibited term found, reported per field.
 */
import { readFileSync } from 'node:fs';

export function stripMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [label](url) -> label
    .replace(/[*_`]+/g, ''); // bold/italic/code markers
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findViolations(text, terms) {
  const stripped = stripMarkdown(text);
  const hits = [];
  for (const term of terms) {
    // Whole-word: term may itself contain spaces (multi-word phrases like
    // "forks Ectropy"), so \b only anchors the first/last word, not each
    // internal boundary -- correct for phrase matching.
    const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
    if (re.test(stripped)) hits.push(term);
  }
  return hits;
}

export function collectTextFields(page) {
  const fields = [];
  if (page.seo?.title) fields.push({ path: 'seo.title', text: page.seo.title });
  if (page.seo?.description) fields.push({ path: 'seo.description', text: page.seo.description });
  for (const section of page.sections ?? []) {
    const base = `sections[${section.sectionId}]`;
    if (section.eyebrow) fields.push({ path: `${base}.eyebrow`, text: section.eyebrow });
    if (section.heading) fields.push({ path: `${base}.heading`, text: section.heading });
    if (section.subheading) fields.push({ path: `${base}.subheading`, text: section.subheading });
    for (const [i, block] of (section.blocks ?? []).entries()) {
      fields.push({ path: `${base}.blocks[${i}].text`, text: block.text });
      if (block.label) fields.push({ path: `${base}.blocks[${i}].label`, text: block.label });
    }
    for (const [i, cta] of (section.ctas ?? []).entries()) {
      fields.push({ path: `${base}.ctas[${i}].label`, text: cta.label });
    }
    for (const [i, claim] of (section.claims ?? []).entries()) {
      fields.push({ path: `${base}.claims[${i}].text`, text: claim.text });
    }
    // crossLinks[].relationshipLine is deliberately NOT included -- exempt
    // per RULE-CONTENT-PAGE-LEXICON-PROHIBITED-1's own carve-out.
  }
  return fields;
}

/**
 * Merges a brand's own prohibited list with luhtech-business's, then drops
 * the current brand's own name/id from the result -- LuhTech-Business's
 * list legitimately names every OTHER venture as a sibling, including,
 * from its perspective, this page's own venture. A page obviously mentions
 * its own name constantly (seo.title alone guarantees it); that must never
 * be a violation regardless of which source list it came from.
 */
export function buildProhibitedTerms(brand, luhtechBrand) {
  const terms = new Set([
    ...(brand.voice?.lexicon?.prohibited ?? []),
    ...(luhtechBrand?.voice?.lexicon?.prohibited ?? []),
  ]);
  const ownNames = [brand.brandId, brand.identity?.name].filter(Boolean);
  for (const own of ownNames) {
    for (const t of [...terms]) {
      if (t.toLowerCase() === own.toLowerCase()) terms.delete(t);
    }
  }
  return terms;
}

function main() {
  const [, , pagePath, brandPath, luhtechBrandPath] = process.argv;
  if (!pagePath || !brandPath) {
    console.error('Usage: luhtech-page-lexicon <path-to-page.json> <path-to-brand-identity.json> [path-to-luhtech-business-brand-identity.json]');
    process.exit(1);
  }

  const page = JSON.parse(readFileSync(pagePath, 'utf-8'));
  const brand = JSON.parse(readFileSync(brandPath, 'utf-8'));
  const luhtechBrand = luhtechBrandPath ? JSON.parse(readFileSync(luhtechBrandPath, 'utf-8')) : null;

  const terms = buildProhibitedTerms(brand, luhtechBrand);

  if (terms.size === 0) {
    console.log('luhtech-page-lexicon: no prohibited terms found on the brand instance(s) -- nothing to check (voice not yet authored?).');
    return;
  }

  const fields = collectTextFields(page);
  let violationCount = 0;

  for (const field of fields) {
    const hits = findViolations(field.text, terms);
    if (hits.length > 0) {
      violationCount += hits.length;
      console.error(`[VIOLATION] ${field.path}: contains prohibited term(s) [${hits.join(', ')}] -- "${field.text}"`);
    }
  }

  console.log(`\nluhtech-page-lexicon: ${fields.length} field(s) checked against ${terms.size} prohibited term(s), ${violationCount} violation(s).`);
  if (violationCount > 0) process.exit(1);
}

// Only run as a CLI when invoked directly (not when imported for tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
