# @luhtech/site-template

One Astro component library renders every LuhTech venture marketing site from
its own `content/page.schema.json` + `content/site.schema.json` instances.
Copy is a derived surface -- the instances are the authored source, this
package is the renderer, and it validates on every build so an invalid
instance fails the build instead of shipping.

```
npm install @luhtech/site-template
```

Published to npmjs.com (public, Apache-2.0) via trusted publishing (GitHub
OIDC) -- no `NPM_TOKEN`, no read token, nothing for a consumer to configure
at build time. Superseded the 0.2.0 GitHub Packages artifact under
`@luh-tech/site-template`, which required a `LUHTECH_PKG_READ` token at
every consumer's install step and broke Cloudflare Workers Build for any
site with no way to supply one (GTM-L3 G1.4-R, 2026-09-08).

## The contract

- **`loadSite(path)`** / **`loadPage(path)`** (`@luhtech/site-template/content`)
  read a JSON file and ajv-validate it against the live, version-pinned
  schema (`package.json`'s `luhtech.schemaPins`) plus its real `$ref` chain.
  Throws on any validation failure.
- **`<SiteLayout site={site} page={page}>`** (`@luhtech/site-template/layouts/SiteLayout.astro`)
  renders nav from `site.nav`, footer from `site.footer.legalLine` +
  `parentHref`, and `<head>` from `page.seo` (title, description, og:\*,
  twitter:\*). `og:image`'s "must not be a staging host" rule is enforced by
  the schema itself, not this layout. Stamps `<html class="no-js">` and
  removes it via an inline script before paint (fixed 0.3.0) --
  `[data-reveal]` sections rely on a `.no-js [data-reveal]{opacity:1}`
  fallback rule in each consumer's own `global.css` in case the deferred
  reveal script fails to load; that rule had nothing to key off before this.
- **`<Section section={s} />`** (`@luhtech/site-template/components/Section.astro`)
  dispatches on `sectionKind` to one component per kind: `Hero`, `Problem`,
  `Approach`, `Proof`, `Audiences`, `Open`, `Status`, `Sources`, `Cta`,
  `Legal` (all under `components/sections/`). `blocks[]` render by
  `blockType` via the shared `Block` component; `figures[]` render with
  `provenance.sourceRef` (in `Sources`); `crossLinks[]` render as name +
  relationshipLine + href -- the one schema-legal way a page names a
  sibling brand -- **for every `sectionKind`, generically**, not just
  `open` (fixed 0.3.0: `about.json`/`insights.json`'s `crossLinks` entries
  on `hero`/`proof` sections were silently invisible before this).
- **`<SplashHero {...} />`** (`@luhtech/site-template/components/SplashHero.astro`)
  -- a trigger-flow hero: full-bleed photo, a one-time splash intro on load
  (wireframe wordmark -> white-fill wave -> fly-out into the real nav logo's
  on-screen position, measured at play time), then never repeats for that
  session (`sessionStorage`, keyed by your own `sessionKey` so two on one
  origin don't collide). Lifted out of Ectropy's own hand-built splash
  (2026-09-03) into a real, parameterized component: photo, wordmark SVG
  markup + viewBox, heading/lede/eyebrow/ctas, an optional drifting
  background data-text layer, and the nav-logo fly-out target selector are
  all props -- the motion mechanics (timing, reduced-motion handling,
  fly-out math) are fixed and proven live. `heading`/`lede` are meant to
  carry the same `brand.identity.tagline`/`oneLiner` values
  `applyBrandDefaults()` binds onto a standard `Hero` section on `/` -- this
  is a presentation alternative to `Hero`, not a different binding rule; a
  consumer still calls `applyBrandDefaults()` and reads the result. Use it
  in place of `<Section>` for the `hero`-kind section only, rendering the
  rest of `page.sections` (filtered to exclude that one) through `<Section>`
  as usual. See `~/dev/luhtech/Ectropy-Business/apps/marketing-site/src/pages/index.astro`
  for the reference consumer.
- **`loadBrand(path)`** (`@luhtech/site-template/content`) reads a
  `content/brand/<venture>.json` file and ajv-validates it against the live,
  version-pinned `portfolio/brand-identity.schema.json`. Mirrors
  `loadPage`/`loadSite`.
- **`applyBrandDefaults(page, brand)`** (`@luhtech/site-template/content`) --
  GTM-L3 G1.1/G1.2: on the page whose `route` is `/`, returns a copy of
  `page` with `sections[hero].heading` replaced by `brand.identity.tagline`,
  the hero's `lede` block replaced by `brand.identity.oneLiner`, and
  `seo.title`/`seo.description` replaced by the brand-derived pair
  (`"<brand.name> -- <identity.oneLiner>"` / `identity.oneLiner`). Any
  authored value it overrides logs a build warning naming the field.
  Interior pages (`route !== '/'`) pass through unchanged -- they keep their
  own heading and `seo`; the `"<page heading> -- <brand.name>"` title
  pattern for interior pages is a content-authoring convention for the page
  instance itself, not a runtime override (`seo.title`/`seo.description`
  are schema-required non-empty strings, so there is no "empty" state for
  either route kind to default from).
- `SiteLayout` also appends `{ label: "LuhTech Holdings", href:
  "https://luh.tech" }` as the last nav item on every site whose
  `ventureRef !== "luhtech-business"`, unless the site's own `nav[]` already
  has an entry pointing at that href.
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

## Article sections, table of contents, linkable blocks

Added in 0.4.0 (d-2026-09-08-sr-article-venture-site-bridge), the schema-first
foundation for bridging business-tools' real article pipeline into a
venture's own marketing site instead of only dash.luh.tech's bare preview:

- `sectionKind: "article"` (`sections/Article.astro`) renders a long-form
  article body -- a real, distinct kind from `proof`/`approach`/etc., since
  none of the existing ten fit an article's own reading experience.
- `block.blockType` gained `stat` (a styled illustrative/rhetorical
  callout -- never a citable fact; a real sourced number is always a
  section-level `figures[]` entry) and `close` (a marked concluding
  paragraph, styled with a top rule).
- `block.href` (optional, same shape as `cta.href`) makes any individual
  block a real link -- an `audiences` card pointing at a market-specific
  page, or a `list`/`definition` entry pointing at an article's own page.
  `Block.astro` wraps whatever the blockType already renders in an outer
  `<a>`, so link behavior is uniform across every blockType.
- `TableOfContents.astro` (new, generic component): derives a real jump-list
  from `page.sections[].heading`, linking each entry to that section's own
  `id={section.sectionId}` (every `sections/*.astro` component already
  stamps this). Renders nothing for a page with 0-1 headinged sections --
  a one-entry TOC is noise, not navigation. Does not attempt to derive
  sub-headings from inside a single article section's `blocks[]` -- the
  article chunk vocabulary (lede/section/pullquote/stat/close) has no
  heading-level chunk, so there is nothing real to link to below
  section-level today.

## Sticky side-nav and back-navigation (0.5.0)

Real long-form/multi-section pages (Platform, Open, About-style pages -- not
splash/hero landing pages, which have nothing worth jumping to) get the same
sticky-TOC-plus-scrollspy treatment the rest of the industry has converged on
(Docusaurus, Mintlify, Nextra, VitePress, Astro Starlight all ship a variant
of this exact pattern; Stripe's own docs use the sibling breadcrumb
convention for the same reason -- orient the reader inside a long page):

- `TableOfContents.astro` gained real scrollspy: an `IntersectionObserver`
  (the same convention `SiteLayout`'s own `[data-reveal]` reveal-on-scroll
  script already uses, not a second one) tracks which linked section is
  current and stamps `aria-current` on its link. The active link gets a
  persistent left accent-bar + ink color + medium weight -- not just a hover
  state. A consumer wires it exactly as before (`<TableOfContents
  sections={page.sections} />` inside a `sticky` aside); the scrollspy is
  automatic, and degrades to a plain static jump-list if JS never runs.
- `BackLink.astro` (new): the canonical "back to X" pattern -- a real
  chevron icon (inline SVG, not the `&larr;` glyph) with a hover
  micro-interaction, replacing the bare `<a>&larr; X</a>` markup that had
  been hand-duplicated per consumer. `<BackLink href="/insights/"
  label="Insights" />`.
- Consumer guidance: only wrap a page's sections in the two-column
  `grid-cols-[1fr_200px]` + sticky-aside layout when it actually has more
  than one headinged section (`page.sections.filter(s => s.heading).length
  > 1` -- the same condition `TableOfContents` itself gates on). Reserving
  an empty 200px rail next to a single-section page is dead space, not
  navigation.

## Migrating a venture site

A migration is: author `content/site.<venture>.json` + `content/pages/*.json`
(the content, not new copy -- lift the current live text verbatim into
sections), add one template dependency (`@luhtech/site-template`), and
replace the site's inline `index.astro` with a call into `SiteLayout` +
`Section`:

```astro
---
import { loadSite, loadPage, loadBrand, applyBrandDefaults } from '@luhtech/site-template/content';
import SiteLayout from '@luhtech/site-template/layouts/SiteLayout.astro';
import Section from '@luhtech/site-template/components/Section.astro';

const site = await loadSite('content/sites/<venture>.json');
const brand = await loadBrand('content/brand/<venture>.json');
const page = applyBrandDefaults(await loadPage('content/pages/home.json'), brand);
---
<SiteLayout site={site} page={page}>
  {page.sections.map((s) => <Section section={s} site={site} />)}
</SiteLayout>
```

Every route calls `loadPage` + `applyBrandDefaults` this way, not just `/` --
the function is a no-op on interior routes and keeps the call site uniform.

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
