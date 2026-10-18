import type { APIRoute, GetStaticPaths } from 'astro';

import { PACKAGE_CATALOG, PACKAGES_DIRECTORY } from '../../../site.config.ts';
import {
  loadListedPackages,
  type IListedPackage,
} from '../../../utilities/package-catalog/index.ts';
import { loadPackageMarkdown, toTextResponse } from '../../../utilities/site-markdown/index.ts';

export const getStaticPaths = (async () =>
  (await loadListedPackages(PACKAGE_CATALOG, PACKAGES_DIRECTORY)).map((listedPackage) => ({
    params: { name: listedPackage.name },
    props: { package: listedPackage },
  }))) satisfies GetStaticPaths;

// a package page's Markdown version: its header, its README, and its API reference
export const GET: APIRoute<{ package: IListedPackage }> = async ({ props }) =>
  toTextResponse(await loadPackageMarkdown(props.package), 'text/markdown');
