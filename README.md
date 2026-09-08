# @luhtech/site-template

One Astro component library renders every LuhTech venture marketing site from
its own `content/page.schema.json` + `content/site.schema.json` instances.
Copy is a derived surface -- the instances are the authored source, this
package is the renderer, and it validates on every build so an invalid
instance fails the build instead of shipping.

## The contract

- **`loadSite(path)`** / **`loadPage(path)`** (`@luhtech/site-template/content`)
  read a JSON file and ajv-validate it against the live, version-pinned
  schema (`package.json`'s `luhtech.schemaPins`) plus its real `$ref` chain.
  Throws on any validation failure.
- **`<SiteLayout site={site} page={page}>`** (`@luhtech/site-template/layouts/SiteLayout.astro`)
  renders nav from `site.nav`, footer from `site.footer.legalLine` +
  `parentHref`, and `<head>` from `page.seo` (title, description, og:\*,
  twitter:\*). `og:image`'s "must not be a staging host" rule is enforced by
  the schema itself, not this layout.
- **`<Section section={s} />`** (`@luhtech/site-template/components/Section.astro`)
  dispatches on `sectionKind` to one component per kind: `Hero`, `Problem`,
  `Approach`, `Proof`, `Audiences`, `Open`, `Status`, `Sources`, `Cta`,
  `Legal` (all under `components/sections/`). `blocks[]` render by
  `blockType` via the shared `Block` component; `figures[]` render with
  `provenance.sourceRef` (in `Sources`); `crossLinks[]` render as name +
  relationshipLine + href -- the one schema-legal way a page names a
  sibling brand.
- **`<LeadCaptureForm leadCapture={site.leadCapture} />`** -- the real
  contact-form pattern (originally Replique's own form/script) parameterised
  off `site.leadCapture`: `destination` is a schema const shared by every
  site, `source`/`ventureField`/`honeypotField`/`minSubmitMs` vary per site.
- **`luhtech-tokens <brand.json> <output.css>`** (bin) generates
  `tokens.generated.css` from a `content/brand/<brand>.json` instance
  (display Sora / body Inter / mono JetBrains Mono) -- run this in your
  `predev`/`prebuild` script, the same place every venture repo already
  calls its own `generate-tokens.mjs`.
- **`luhtech-page-lexicon <page.json> <brand.json> [luhtech-business-brand.json]`**
  (bin) -- RULE-CONTENT-PAGE-LEXICON-PROHIBITED-1: fails if any text-bearing
  field contains a term from the brand's (or LuhTech-Business's)
  `voice.lexicon.prohibited[]`. `crossLinks[].relationshipLine` is exempt.
- **`luhtech-page-claims <page.json>`** (bin) -- RULE-CONTENT-PAGE-CLAIM-CEILING-1:
  fails if any `kind=built` claim's `sourcedStatus` exceeds the real feature's
  status on the ladder `concept < planned < partial < operational`.
  Resolves `featureRef` against `.roadmap/roadmap.json`'s `features[]` (via
  the GitHub contents API at each venture's own `main`), except venture
  `ectropy`, which has no `features[]` array and resolves instead against
  `.roadmap/features/<id>/FEATURE.json` in `Ectropy-Business` -- the same
  file `eb-agent` reads under the hood, since this bin runs in plain CI with
  no MCP access. `kind=method` claims describe design intent regardless of
  status and are reported, never failed.

## A known, out-of-scope gap

`content/capability-claim.schema.json` 404s at both its bare and
version-pinned live URLs (a schema-registry publish-pipeline issue, not
something this package can fix). `loadPage`'s validator falls back to a
vendored local copy (`src/content/_vendored-schema-fallback/`, fetched from
the real schema-registry source, not fabricated) only for this one schema,
and logs a warning when it does. Every other schema fetch failure is a hard
error.

## Migrating a venture site

A migration is: author `content/site.<venture>.json` + `content/pages/*.json`
(the content, not new copy -- lift the current live text verbatim into
sections), add one template dependency (`@luhtech/site-template`), and
replace the site's inline `index.astro` with a call into `SiteLayout` +
`Section`:

```astro
---
import { loadSite, loadPage } from '@luhtech/site-template/content';
import SiteLayout from '@luhtech/site-template/layouts/SiteLayout.astro';
import Section from '@luhtech/site-template/components/Section.astro';

const site = await loadSite('content/sites/<venture>.json');
const page = await loadPage('content/pages/home.json');
---
<SiteLayout site={site} page={page}>
  {page.sections.map((s) => <Section section={s} site={site} />)}
</SiteLayout>
```

`site` is passed through to every `<Section>` call but only actually used by
the `cta` sectionKind, which embeds the real `LeadCaptureForm` directly
(matching the schema's own description of `cta`: "lead-capture"). Don't also
render a standalone `<LeadCaptureForm>` when the page has a `cta` section --
the two would duplicate the heading and produce a dead-end button ahead of
the real form (found live during Replique's migration, GTM-L2 C3). A page
with no `cta` section can still render `<LeadCaptureForm leadCapture=
{site.leadCapture} />` directly wherever it needs one.

Run `luhtech-tokens content/brand/<brand>.json src/styles/tokens.generated.css`
in `predev`/`prebuild` as before. Run both check bins in CI against every
`content/pages/*.json` the repo carries.

## Peer dependencies

`astro ^7.2`, `tailwindcss ^4`.
