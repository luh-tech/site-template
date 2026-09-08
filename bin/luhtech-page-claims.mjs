#!/usr/bin/env node
/**
 * RULE-CONTENT-PAGE-CLAIM-CEILING-1: kind=built claims must be backed by
 * real feature status at or above sourcedStatus on the ladder
 *   concept < planned < partial < operational
 * kind=method claims describe design intent regardless of status -- no
 * ceiling check, reported but never failed.
 *
 * Resolver: a claim's featureRef (urn:luhtech:<venture>:feature:<id>) is
 * resolved against .roadmap/roadmap.json's features[] (fetched from the
 * venture's own repo at origin/main via the GitHub REST contents API), or
 * -- for venture "ectropy" specifically, which resolves features via
 * eb-agent, not a roadmap.json features array (confirmed repeatedly: no
 * features[] array exists for ectropy) -- .roadmap/features/<id>/FEATURE.json
 * in luh-tech/Ectropy-Business, the same file eb-agent itself reads under
 * the hood. This bin runs in plain CI (no MCP access), so it reads the real
 * file directly rather than trying to invoke eb-agent.
 *
 * Usage: luhtech-page-claims <path-to-page.json>
 * Exit 0: every built claim's sourcedStatus <= real feature status (or null,
 *         which skips the ceiling but still requires featureRef to resolve).
 * Exit 1: any built claim exceeds real status, or featureRef is dangling.
 */
import { readFileSync } from 'node:fs';

const REPO_BY_VENTURE = {
  jobsitecontrol: 'JobsiteControl',
  qullqa: 'Qullqa',
  viiva: 'Viiva',
  siltana: 'Siltana-Business',
  ohjaus: 'Ohjaus',
  raizal: 'Raizal',
  hilja: 'Hilja',
  replique: 'Replique',
  'luhtech-business': 'LuhTech-Business',
};

const LADDER = ['concept', 'planned', 'partial', 'operational'];

// Real roadmap.json feature-status vocabulary -> the ladder (established
// convention used consistently across this portfolio's own claim-ceiling
// passes): concept/planned map 1:1; in-progress/prototype are "partial"
// (exists, not complete); complete/production are "operational".
const ROADMAP_STATUS_TO_LADDER = {
  concept: 'concept',
  planned: 'planned',
  'in-progress': 'partial',
  prototype: 'partial',
  complete: 'operational',
  production: 'operational',
};

// Ectropy FEATURE.json's own status vocabulary (UPPER_CASE, distinct from
// roadmap.json's lowercase convention -- confirmed: PLANNED, BETA,
// PRODUCTION, etc.) -> the same ladder.
const FEATURE_JSON_STATUS_TO_LADDER = {
  PLANNED: 'planned',
  BETA: 'partial',
  PRODUCTION: 'operational',
};

const [, , pagePath] = process.argv;
if (!pagePath) {
  console.error('Usage: luhtech-page-claims <path-to-page.json>');
  process.exit(1);
}

const GH_API = 'https://api.github.com';
const ghHeaders = () => {
  const h = { Accept: 'application/vnd.github.v3+json' };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

async function ghContents(repo, path) {
  const url = `${GH_API}/repos/luh-tech/${repo}/contents/${path}?ref=main`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) {
    throw new Error(`GitHub contents fetch failed for ${repo}/${path}: HTTP ${res.status}`);
  }
  const body = await res.json();
  return JSON.parse(Buffer.from(body.content, 'base64').toString('utf-8'));
}

async function resolveFeatureStatus(featureRef) {
  const m = featureRef.match(/^urn:luhtech:([a-z0-9-]+):feature:([a-z0-9-]+)$/);
  if (!m) throw new Error(`Malformed featureRef: ${featureRef}`);
  const [, venture, featureId] = m;

  if (venture === 'ectropy') {
    const doc = await ghContents('Ectropy-Business', `.roadmap/features/${featureId}/FEATURE.json`);
    const rung = FEATURE_JSON_STATUS_TO_LADDER[doc.status];
    if (!rung) throw new Error(`Ectropy feature ${featureId}: unrecognized status "${doc.status}"`);
    return rung;
  }

  const repo = REPO_BY_VENTURE[venture];
  if (!repo) throw new Error(`No repo mapping for venture "${venture}" (featureRef ${featureRef})`);
  const doc = await ghContents(repo, '.roadmap/roadmap.json');
  const feature = (doc.features ?? []).find((f) => f.id === featureId);
  if (!feature) throw new Error(`${repo}: no feature "${featureId}" in .roadmap/roadmap.json features[]`);
  const rung = ROADMAP_STATUS_TO_LADDER[feature.status];
  if (!rung) throw new Error(`${repo} feature ${featureId}: unrecognized status "${feature.status}"`);
  return rung;
}

function ladderIndex(rung) {
  const i = LADDER.indexOf(rung);
  if (i === -1) throw new Error(`Unknown ladder rung: ${rung}`);
  return i;
}

async function main() {
  const page = JSON.parse(readFileSync(pagePath, 'utf-8'));
  const claims = (page.sections ?? []).flatMap((s) => (s.claims ?? []).map((c) => ({ ...c, sectionId: s.sectionId })));

  let violations = 0;
  let checked = 0;

  for (const claim of claims) {
    if (claim.kind === 'method') {
      console.log(`[method, no ceiling] ${claim.sectionId}/${claim.claimId}: "${claim.text}"`);
      continue;
    }
    // kind === 'built'
    if (!claim.featureRef) {
      console.error(`[VIOLATION] ${claim.sectionId}/${claim.claimId}: kind=built with no featureRef (schema should have rejected this)`);
      violations++;
      continue;
    }
    checked++;
    let realStatus;
    try {
      realStatus = await resolveFeatureStatus(claim.featureRef);
    } catch (err) {
      console.error(`[VIOLATION] ${claim.sectionId}/${claim.claimId}: ${err.message}`);
      violations++;
      continue;
    }
    if (claim.sourcedStatus == null) {
      console.log(`[built, no sourcedStatus ceiling] ${claim.sectionId}/${claim.claimId}: featureRef resolved, real status = ${realStatus}`);
      continue;
    }
    if (ladderIndex(claim.sourcedStatus) > ladderIndex(realStatus)) {
      console.error(
        `[VIOLATION] ${claim.sectionId}/${claim.claimId}: claims sourcedStatus="${claim.sourcedStatus}" but real feature status is "${realStatus}" (${claim.featureRef})`
      );
      violations++;
    } else {
      console.log(`[ok] ${claim.sectionId}/${claim.claimId}: sourcedStatus="${claim.sourcedStatus}" <= real "${realStatus}"`);
    }
  }

  console.log(`\nluhtech-page-claims: ${claims.length} claim(s), ${checked} built-claim(s) resolved, ${violations} violation(s).`);
  if (violations > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`luhtech-page-claims failed: ${err.message}`);
  process.exit(1);
});
