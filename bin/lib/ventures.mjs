// Shared venture registry for the luhtech-sync-* bin tools -- real repo
// directory name + real favicon path + (where it exists) real Logo.astro
// path + real committed animated-mark svg path + real canonical brand.json
// path, per venture. Kept in one place so the sync tools can't drift
// against each other the way the per-venture marks drifted against each
// venture's own real favicon before this tooling existed.
export const VENTURES = [
  { id: 'ectropy', repo: 'Ectropy-Business', favicon: 'apps/marketing-site/public/favicon.svg', logoAstro: 'apps/marketing-site/src/components/Logo.astro', animatedMarkSvg: 'apps/marketing-site/public/brand/ectropy-mark-animated.svg', brandJson: 'apps/marketing-site/content/brand/ectropy.json' },
  { id: 'qullqa', repo: 'Qullqa', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro', animatedMarkSvg: 'public/brand/qullqa-mark-animated.svg', brandJson: 'content/brand/qullqa.json' },
  { id: 'siltana', repo: 'Siltana-Business', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro', animatedMarkSvg: 'public/brand/siltana-mark-animated.svg', brandJson: 'content/brand/siltana.json' },
  { id: 'jobsitecontrol', repo: 'JobsiteControl', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro', animatedMarkSvg: 'public/brand/jobsitecontrol-mark-animated.svg', brandJson: 'content/brand/jobsitecontrol.json' },
  { id: 'viiva', repo: 'Viiva', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro', animatedMarkSvg: 'public/brand/viiva-mark-animated.svg', brandJson: 'content/brand/viiva.json' },
  { id: 'ohjaus', repo: 'Ohjaus', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro', animatedMarkSvg: 'public/brand/ohjaus-mark-animated.svg', brandJson: 'content/brand/ohjaus.json' },
  { id: 'raizal', repo: 'Raizal', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro', animatedMarkSvg: 'public/brand/raizal-mark-animated.svg', brandJson: 'content/brand/raizal.json' },
  { id: 'replique', repo: 'Replique', favicon: 'site/public/favicon.svg', logoAstro: 'site/src/components/Logo.astro', animatedMarkSvg: 'site/public/brand/replique-mark-animated.svg', brandJson: 'content/brand/replique.json' },
  { id: 'hilja', repo: 'Hilja', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro', animatedMarkSvg: 'public/brand/hilja-mark-animated.svg', brandJson: 'content/brand/hilja.json' },
];
