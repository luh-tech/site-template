// Shared venture registry for the luhtech-sync-* bin tools -- real repo
// directory name + real favicon path + (where it exists) real Logo.astro
// path, per venture. Kept in one place so luhtech-sync-marks.mjs and
// luhtech-sync-animated-marks.mjs can't drift against each other the way
// the per-venture marks drifted against each venture's own real favicon
// before this tooling existed.
export const VENTURES = [
  { id: 'ectropy', repo: 'Ectropy-Business', favicon: 'apps/marketing-site/public/favicon.svg', logoAstro: 'apps/marketing-site/src/components/Logo.astro' },
  { id: 'qullqa', repo: 'Qullqa', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro' },
  { id: 'siltana', repo: 'Siltana-Business', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro' },
  { id: 'jobsitecontrol', repo: 'JobsiteControl', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro' },
  { id: 'viiva', repo: 'Viiva', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro' },
  { id: 'ohjaus', repo: 'Ohjaus', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro' },
  { id: 'raizal', repo: 'Raizal', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro' },
  { id: 'replique', repo: 'Replique', favicon: 'site/public/favicon.svg', logoAstro: 'site/src/components/Logo.astro' },
  { id: 'hilja', repo: 'Hilja', favicon: 'public/favicon.svg', logoAstro: 'src/components/Logo.astro' },
];
