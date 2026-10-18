import { describe, expect, test } from 'vitest';

import { PACKAGE_CATALOG, PACKAGES_DIRECTORY } from '../../site.config.ts';
import { findCatalogProblems, readWorkspaceManifests } from './package-catalog.ts';
import type { IPackageCatalogEntry, IPackageIcon } from './types.ts';

// distinct icons for the test entries, picked by order
const ICONS: readonly IPackageIcon[] = ['braces', 'calculator', 'cloud-off', 'cpu'];

/**
 * Builds a catalog entry.
 * @param order The order.
 * @param description The description.
 * @param icon The icon.
 * @returns The entry.
 */
const entry = (
  order: number,
  description = 'x'.repeat(80),
  icon: IPackageIcon = ICONS[order % ICONS.length] ?? 'cpu',
): IPackageCatalogEntry => ({
  title: 'Example',
  description,
  icon,
  runtimes: ['universal'],
  order,
});

describe('findCatalogProblems', () => {
  test('accepts a catalog that lists every published package except the unlisted ones', () => {
    expect(
      findCatalogProblems({ 'jg-a': entry(1), 'jg-b': entry(2) }, [
        { name: 'jg-a', version: '1.0.0' },
        { name: 'jg-b', version: '1.0.0' },
        { name: 'jg-personal-astro-ui', version: '0.1.0' },
        { name: 'jg-private', version: '0.0.0', private: true },
      ]),
    ).toStrictEqual([]);
  });

  test('reports missing and extra packages, repeated orders and icons, and descriptions of the wrong length', () => {
    expect(
      findCatalogProblems(
        {
          'jg-a': entry(1, 'Too short.'),
          'jg-c': entry(1),
          'jg-personal-astro-ui': entry(2, undefined, 'calculator'),
        },
        [
          { name: 'jg-a', version: '1.0.0' },
          { name: 'jg-b', version: '1.0.0' },
          { name: 'jg-personal-astro-ui', version: '0.1.0' },
        ],
      ),
    ).toStrictEqual([
      'jg-b is published from packages/ but missing from the catalog',
      "jg-a's description has 10 characters, outside 70 to 160",
      "jg-c is in the catalog but isn't a listed package under packages/",
      'jg-c has the same order as jg-a: 1',
      'jg-c has the same icon as jg-a: calculator',
      "jg-personal-astro-ui is in the catalog but isn't a listed package under packages/",
      'jg-personal-astro-ui has the same icon as jg-a: calculator',
    ]);
  });
});

describe('PACKAGE_CATALOG', () => {
  test('matches the workspace', async () => {
    expect(
      findCatalogProblems(PACKAGE_CATALOG, await readWorkspaceManifests(PACKAGES_DIRECTORY)),
    ).toStrictEqual([]);
  });
});
