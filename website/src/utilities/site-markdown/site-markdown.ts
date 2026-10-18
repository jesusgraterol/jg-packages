import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { renderApiMarkdown, type IApiReference } from '@jg-packages/api-reference';
import { getEntry } from 'astro:content';

import { PACKAGES_DIRECTORY, SITE_CONFIG } from '../../site.config.ts';
import { buildPackageMarkdown, toMarkdownPath } from '../markdown-pages/index.ts';
import { RUNTIMES, type IListedPackage } from '../package-catalog/index.ts';

/*
 * The Markdown the site serves for a package, read through Astro's content layer and the generated
 * API references, so it only runs inside the build.
 */

// every package's API reference, written by the generate task
const API_REFERENCES = import.meta.glob<IApiReference>('../../generated/api/*.json', {
  eager: true,
  import: 'default',
});

/**
 * Reads a package's API reference, which the generate task writes before every build.
 * @param name The package's name.
 * @returns The reference.
 * @throws
 * - {name} has no API reference. Run the site's tasks through Turborepo, …
 */
export const loadApiReference = (name: string): IApiReference => {
  const reference = API_REFERENCES[`../../generated/api/${name}.json`];
  if (reference === undefined) {
    throw new Error(
      `${name} has no API reference. Run the site's tasks through Turborepo, such as pnpm turbo run build --filter=@jg-packages/website, so generate runs first.`,
    );
  }
  return reference;
};

/**
 * Builds a package page's Markdown version from its README and its API reference.
 * @param listedPackage The package.
 * @returns The Markdown.
 * @throws
 * - {name} has no README entry
 */
export const loadPackageMarkdown = async (listedPackage: IListedPackage): Promise<string> => {
  const { name } = listedPackage;
  const readme = await getEntry('packageReadmes', name);
  if (readme === undefined) {
    throw new Error(`${name} has no README entry`);
  }
  return buildPackageMarkdown(
    {
      description: listedPackage.description,
      name,
      runtimes: listedPackage.runtimes.map((runtime) => RUNTIMES[runtime].label),
      version: listedPackage.version,
    },
    {
      npmUrl: `${SITE_CONFIG.npmUrl}${name}`,
      recipesUrl: new URL(toMarkdownPath(`/packages/${name}/recipes/`), SITE_CONFIG.url).toString(),
      sourceUrl: `${SITE_CONFIG.repositoryUrl}/tree/main/packages/${name}`,
    },
    readme.body ?? '',
    renderApiMarkdown(loadApiReference(name), { headingLevel: 2 }),
  );
};

/**
 * Reads a package's RECIPES.md as it ships, which is its recipes page's Markdown version.
 * @param name The package's name.
 * @returns The file's text.
 */
export const loadRecipesMarkdown = (name: string): Promise<string> =>
  readFile(join(PACKAGES_DIRECTORY, name, 'RECIPES.md'), 'utf8');

/**
 * Reads the sentence under a RECIPES.md's title, which says what its recipes show.
 * @param markdown The RECIPES.md.
 * @returns The sentence.
 */
export const readRecipesSummary = (markdown: string): string =>
  markdown
    .replace(/^#\s.*\n/u, '')
    .trim()
    .split('\n\n')[0]
    ?.trim() ?? '';

// a text response with its content type, for the site's Markdown and text routes
export const toTextResponse = (
  body: string,
  contentType: 'text/markdown' | 'text/plain',
): Response => new Response(body, { headers: { 'Content-Type': `${contentType}; charset=utf-8` } });
