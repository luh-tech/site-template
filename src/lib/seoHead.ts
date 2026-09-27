// Browser + search metadata SiteLayout emits beyond page.seo's own
// title/description/ogImage. Pure so it can be unit-tested; the layout
// passes it what only Astro knows (Astro.site, Astro.url.pathname) and
// which icon files the consuming site actually ships in public/.
//
// d-2026-09-26-sites-browser-seo-baseline: a live audit of all 10 sites
// found 29 of 32 pages with no icon link (every site serves
// /favicon.svg, nothing linked it, so browsers asked for /favicon.ico
// and got a 404), 29 of 32 with no canonical/og:url, and none with
// og:site_name, og:locale, theme-color, apple-touch-icon or a manifest.

export const ICON_FILES = {
  svg: 'favicon.svg',
  appleTouch: 'apple-touch-icon.png',
  png192: 'icon-192.png',
  png512: 'icon-512.png',
  manifest: 'site.webmanifest',
} as const;

export type IconFile = (typeof ICON_FILES)[keyof typeof ICON_FILES];

export interface BrandLike {
  identity?: { name?: string };
  color?: { foundation?: { ink?: { hex?: string }; canvas?: { hex?: string } } };
}

export interface SeoHeadInput {
  /** Astro.site -- the site's configured origin (astro.config `site`). */
  site?: URL | string;
  /** Astro.url.pathname for the page being rendered. */
  pathname: string;
  brand?: BrandLike;
  /** Which ICON_FILES exist in the consuming site's public/ directory. */
  publicFiles: ReadonlySet<string>;
  locale?: string;
}

export interface LinkTag {
  rel: string;
  href: string;
  type?: string;
  sizes?: string;
}

export interface SeoHead {
  canonical: string | null;
  siteName: string | null;
  locale: string;
  themeColor: string | null;
  links: LinkTag[];
}

export function canonicalUrl(site: URL | string | undefined, pathname: string): string | null {
  if (!site) return null;
  return new URL(pathname || '/', site).href;
}

export function buildSeoHead(input: SeoHeadInput): SeoHead {
  const { brand, publicFiles } = input;
  const links: LinkTag[] = [];
  const canonical = canonicalUrl(input.site, input.pathname);
  if (canonical) links.push({ rel: 'canonical', href: canonical });
  if (publicFiles.has(ICON_FILES.svg)) links.push({ rel: 'icon', href: `/${ICON_FILES.svg}`, type: 'image/svg+xml' });
  if (publicFiles.has(ICON_FILES.png192)) links.push({ rel: 'icon', href: `/${ICON_FILES.png192}`, type: 'image/png', sizes: '192x192' });
  if (publicFiles.has(ICON_FILES.appleTouch)) links.push({ rel: 'apple-touch-icon', href: `/${ICON_FILES.appleTouch}`, sizes: '180x180' });
  if (publicFiles.has(ICON_FILES.manifest)) links.push({ rel: 'manifest', href: `/${ICON_FILES.manifest}` });
  return {
    canonical,
    siteName: brand?.identity?.name ?? null,
    locale: input.locale ?? 'en_US',
    // The header renders on bg-ink, so the browser chrome matches it.
    themeColor: brand?.color?.foundation?.ink?.hex ?? null,
    links,
  };
}
