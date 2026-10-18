import type { APIRoute } from 'astro';

import { PACKAGE_CATALOG, PACKAGES_DIRECTORY, SITE_CONFIG } from '../site.config.ts';
import {
  AGENT_RESOURCES,
  AGENT_SETUP_STEPS,
  HOME_BENEFITS,
  HOME_HERO,
  HOME_SECTIONS,
} from '../utilities/home-content/index.ts';
import { buildHomeMarkdown } from '../utilities/markdown-pages/index.ts';
import { groupPackagesByRuntime, loadListedPackages } from '../utilities/package-catalog/index.ts';
import { toTextResponse } from '../utilities/site-markdown/index.ts';

// the home page's Markdown version, with each package linked to its own
export const GET: APIRoute = async () => {
  const packages = await loadListedPackages(PACKAGE_CATALOG, PACKAGES_DIRECTORY);
  return toTextResponse(
    buildHomeMarkdown({
      agentResources: AGENT_RESOURCES,
      benefits: HOME_BENEFITS,
      groups: groupPackagesByRuntime(packages),
      hero: HOME_HERO,
      sections: HOME_SECTIONS,
      setup: { ...SITE_CONFIG.agentSetup, steps: AGENT_SETUP_STEPS },
      site: {
        description: SITE_CONFIG.defaultDescription,
        name: SITE_CONFIG.name,
        url: SITE_CONFIG.url,
      },
    }),
    'text/markdown',
  );
};
