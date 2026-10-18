import type { APIRoute } from 'astro';

import { PACKAGE_CATALOG, PACKAGES_DIRECTORY, SITE_CONFIG } from '../site.config.ts';
import { buildLlmsFullText } from 'jg-personal-astro-ui/llms-text';
import { loadListedPackages } from '../utilities/package-catalog/index.ts';
import {
  loadPackageMarkdown,
  loadRecipesMarkdown,
  toTextResponse,
} from '../utilities/site-markdown/index.ts';

// every package's Markdown version and recipes in one file, for loading into a context window
export const GET: APIRoute = async () => {
  const packages = await loadListedPackages(PACKAGE_CATALOG, PACKAGES_DIRECTORY);
  const documents = await Promise.all(
    packages.map(async (listedPackage) => [
      await loadPackageMarkdown(listedPackage),
      await loadRecipesMarkdown(listedPackage.name),
    ]),
  );
  return toTextResponse(
    buildLlmsFullText({
      documents: documents.flat(),
      name: SITE_CONFIG.name,
      summary: SITE_CONFIG.defaultDescription,
    }),
    'text/plain',
  );
};
