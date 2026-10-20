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

// favicon.ico is generated too (luhtech-sync-icons) but never linked:
// browsers and crawlers request /favicon.ico on their own.

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
  /** content/site 1.5.0 devices: installable adds the iOS/Android web-app meta. */
  devices?: SiteDevices;
}

/** content/site.schema.json 1.5.0 `devices` (d-2026-10-19-sr-site-devices). */
export interface SiteDevices {
  supported: Array<'phone' | 'tablet' | 'desktop'>;
  installable?: boolean;
}

export interface MetaTag {
  name: string;
  content: string;
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
  /** Web-app meta for an installable site (content/site devices.installable). */
  metas: MetaTag[];
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
  // An installable site opens from the home screen without browser chrome. The
  // status bar keeps its default style so content never sits under it.
  const siteName = brand?.identity?.name ?? null;
  const metas: MetaTag[] = input.devices?.installable
    ? [
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        ...(siteName ? [{ name: 'apple-mobile-web-app-title', content: siteName }] : []),
      ]
    : [];
  return {
    canonical,
    siteName,
    locale: input.locale ?? 'en_US',
    // The header renders on bg-ink, so the browser chrome matches it.
    themeColor: brand?.color?.foundation?.ink?.hex ?? null,
    links,
    metas,
  };
}
