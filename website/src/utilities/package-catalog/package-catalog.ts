import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DESCRIPTION_LENGTH, UNLISTED_PACKAGES, USE_WHEN_LENGTH } from './constants.ts';
import type { IListedPackage, IPackageCatalogEntry, IWorkspaceManifest } from './types.ts';

/**
 * Lists the problems between the catalog and the workspace's packages: every published package
 * except the unlisted ones must have an entry, nothing else may, orders and icons must be unique,
 * every description must be 70 to 160 characters, and every useWhen 40 to 140.
 * @param catalog The catalog, by package name.
 * @param manifests The manifests of the packages under packages/.
 * @returns One message per problem.
 */
export const findCatalogProblems = (
  catalog: Readonly<Record<string, IPackageCatalogEntry>>,
  manifests: readonly IWorkspaceManifest[],
): string[] => {
  const problems: string[] = [];
  const listable = new Set(
    manifests
      .filter(
        ({ name, private: isPrivate }) => isPrivate !== true && !UNLISTED_PACKAGES.includes(name),
      )
      .map(({ name }) => name),
  );
  for (const name of listable) {
    if (!(name in catalog)) {
      problems.push(`${name} is published from packages/ but missing from the catalog`);
    }
  }
  const orders = new Map<number, string>();
  const icons = new Map<string, string>();
  for (const [name, { description, icon, order, useWhen }] of Object.entries(catalog)) {
    if (!listable.has(name)) {
      problems.push(`${name} is in the catalog but isn't a listed package under packages/`);
    }
    // a repeat names the first entry that has the order or icon
    const previous = orders.get(order);
    if (previous === undefined) {
      orders.set(order, name);
    } else {
      problems.push(`${name} has the same order as ${previous}: ${order}`);
    }
    const previousIcon = icons.get(icon);
    if (previousIcon === undefined) {
      icons.set(icon, name);
    } else {
      problems.push(`${name} has the same icon as ${previousIcon}: ${icon}`);
    }
    if (
      description.length < DESCRIPTION_LENGTH.min ||
      description.length > DESCRIPTION_LENGTH.max
    ) {
      problems.push(
        `${name}'s description has ${description.length} characters, outside ${DESCRIPTION_LENGTH.min} to ${DESCRIPTION_LENGTH.max}`,
      );
    }
    if (useWhen.length < USE_WHEN_LENGTH.min || useWhen.length > USE_WHEN_LENGTH.max) {
      problems.push(
        `${name}'s useWhen has ${useWhen.length} characters, outside ${USE_WHEN_LENGTH.min} to ${USE_WHEN_LENGTH.max}`,
      );
    }
  }
  return problems;
};

/**
 * Reads the manifest of every package under a directory.
 * @param packagesDirectory The workspace's packages/ directory.
 * @returns A promise that resolves to the manifests.
 */
export const readWorkspaceManifests = async (
  packagesDirectory: string,
): Promise<IWorkspaceManifest[]> => {
  const directories = await readdir(packagesDirectory, { withFileTypes: true });
  return Promise.all(
    directories
      .filter((entry) => entry.isDirectory())
      .map(
        async ({ name }) =>
          JSON.parse(
            await readFile(join(packagesDirectory, name, 'package.json'), 'utf8'),
          ) as IWorkspaceManifest,
      ),
  );
};

/**
 * Loads the listed packages in catalog order, with each one's version, after checking that the
 * catalog matches the workspace, so a package can never be published without a page.
 * @param catalog The catalog, by package name.
 * @param packagesDirectory The workspace's packages/ directory.
 * @returns A promise that resolves to the listed packages.
 * @throws
 * - The package catalog doesn't match packages/: {problems}
 */
export const loadListedPackages = async (
  catalog: Readonly<Record<string, IPackageCatalogEntry>>,
  packagesDirectory: string,
): Promise<IListedPackage[]> => {
  const manifests = await readWorkspaceManifests(packagesDirectory);
  const problems = findCatalogProblems(catalog, manifests);
  if (problems.length > 0) {
    throw new Error(`The package catalog doesn't match packages/:\n- ${problems.join('\n- ')}`);
  }
  return manifests
    .filter(({ name }) => name in catalog)
    .map(({ name, version }) => ({ ...(catalog[name] as IPackageCatalogEntry), name, version }))
    .sort((first, second) => first.order - second.order);
};
