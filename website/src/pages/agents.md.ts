import type { APIRoute } from 'astro';

import { PACKAGE_CATALOG, PACKAGES_DIRECTORY, SITE_CONFIG } from '../site.config.ts';
import { buildAgentsBlock, buildAgentsBlockLine } from '../utilities/agents-block/index.ts';
import { loadListedPackages } from '../utilities/package-catalog/index.ts';

// the AGENTS.md block for every package, for anyone who fetches it instead of picking on the page
export const GET: APIRoute = async () => {
  const packages = await loadListedPackages(PACKAGE_CATALOG, PACKAGES_DIRECTORY);
  const block = buildAgentsBlock(
    packages.map((listedPackage) => buildAgentsBlockLine(listedPackage, SITE_CONFIG.url)),
  );
  return new Response(`${block}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
