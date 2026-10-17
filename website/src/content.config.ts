import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

import { PACKAGE_CATALOG, PACKAGES_DIRECTORY } from './site.config.ts';
import { packageReadmeLoader } from './utilities/package-readme/index.ts';

export const collections = {
  // each listed package's README, without the sections its page shows another way
  packageReadmes: defineCollection({
    loader: packageReadmeLoader({
      packagesDirectory: PACKAGES_DIRECTORY,
      packageNames: Object.keys(PACKAGE_CATALOG),
    }),
    schema: z.object({ name: z.string() }),
  }),
};
