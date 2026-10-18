import type { APIRoute, GetStaticPaths } from 'astro';

import { PACKAGE_CATALOG, PACKAGES_DIRECTORY } from '../../../../site.config.ts';
import { loadListedPackages } from '../../../../utilities/package-catalog/index.ts';
import { loadRecipesMarkdown, toTextResponse } from '../../../../utilities/site-markdown/index.ts';

export const getStaticPaths = (async () =>
  (await loadListedPackages(PACKAGE_CATALOG, PACKAGES_DIRECTORY)).map(({ name }) => ({
    params: { name },
    props: { name },
  }))) satisfies GetStaticPaths;

// a recipes page's Markdown version: the package's RECIPES.md as it ships
export const GET: APIRoute<{ name: string }> = async ({ props }) =>
  toTextResponse(await loadRecipesMarkdown(props.name), 'text/markdown');
