import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

import { PACKAGE_CATALOG, PACKAGES_DIRECTORY, SITE_CONFIG } from './site.config.ts';
import {
  packageMarkdownLoader,
  rewriteReadmeLinks,
  selectReadmeSections,
  selectRecipes,
} from './utilities/package-docs/index.ts';

// the packages the site lists, each with a page
const PACKAGE_NAMES = Object.keys(PACKAGE_CATALOG);

export const collections = {
  // each listed package's README, without the sections its page shows another way
  packageReadmes: defineCollection({
    loader: packageMarkdownLoader({
      packagesDirectory: PACKAGES_DIRECTORY,
      packageNames: PACKAGE_NAMES,
      fileName: 'README.md',
      select: (markdown, name) =>
        rewriteReadmeLinks(
          selectReadmeSections(markdown),
          new URL(`/packages/${name}/`, SITE_CONFIG.url).href,
          `${SITE_CONFIG.repositoryUrl}/blob/main/packages/${name}/LICENSE`,
        ),
    }),
    schema: z.object({ name: z.string() }),
  }),

  // each listed package's RECIPES.md, without its title, which the recipes page shows itself
  packageRecipes: defineCollection({
    loader: packageMarkdownLoader({
      packagesDirectory: PACKAGES_DIRECTORY,
      packageNames: PACKAGE_NAMES,
      fileName: 'RECIPES.md',
      select: selectRecipes,
    }),
    schema: z.object({ name: z.string() }),
  }),
};
