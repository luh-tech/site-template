import type { LoadedPage } from './loadPage.js';
import type { LoadedBrand } from './loadBrand.js';

/**
 * GTM-L3 G1.1/G1.2: on the page whose route is "/", the hero heading and
 * lede are the brand's locked tagline/oneLiner, not whatever the page
 * instance authored -- an authored value is overridden with a build
 * warning, matching the dispatch's own "ignored" language. <head> seo on
 * "/" is likewise brand-derived (page.schema.json requires seo.title and
 * seo.description to be non-empty strings, so an authored placeholder is
 * expected there and is overridden the same way). Interior pages keep
 * their own heading and seo verbatim -- G1.2's "<page heading> --
 * <brand.name>" formula is a content-authoring convention for those page
 * instances, not a runtime override, for the same schema-required-field
 * reason the "/" override can't be a conditional "if empty" check either.
 */
export function applyBrandDefaults(page: LoadedPage, brand: LoadedBrand): LoadedPage {
  const route = page.route as string;
  const pageLabel = (page.pageId ?? page.$id ?? '(page)') as string;
  const sections = ((page.sections as any[]) ?? []).map((s) => ({ ...s }));
  const bound: LoadedPage = { ...page, sections };

  if (route !== '/') return bound;

  const heroIdx = sections.findIndex((s) => s.sectionKind === 'hero');
  if (heroIdx !== -1) {
    const hero = { ...sections[heroIdx] };
    if (hero.heading && hero.heading !== brand.identity.tagline) {
      console.warn(
        `[site-template] ${pageLabel}: sections[hero].heading ("${hero.heading}") ignored on route "/" -- using brand.identity.tagline instead.`
      );
    }
    hero.heading = brand.identity.tagline;

    const blocks = [...(hero.blocks ?? [])];
    const ledeIdx = blocks.findIndex((b: any) => b.blockType === 'lede');
    const ledeBlock = { blockType: 'lede', text: brand.identity.oneLiner };
    if (ledeIdx !== -1) blocks[ledeIdx] = ledeBlock;
    else blocks.unshift(ledeBlock);
    hero.blocks = blocks;

    sections[heroIdx] = hero;
  }

  const seo = { ...(bound.seo as { title?: string; description?: string }) };
  const computedTitle = `${brand.identity.name} -- ${brand.identity.oneLiner}`;
  if (seo.title && seo.title !== computedTitle) {
    console.warn(
      `[site-template] ${pageLabel}: seo.title ("${seo.title}") overridden on route "/" -- using brand-derived default.`
    );
  }
  seo.title = computedTitle;
  if (seo.description && seo.description !== brand.identity.oneLiner) {
    console.warn(
      `[site-template] ${pageLabel}: seo.description ("${seo.description}") overridden on route "/" -- using brand.identity.oneLiner.`
    );
  }
  seo.description = brand.identity.oneLiner;
  bound.seo = seo;

  return bound;
}
