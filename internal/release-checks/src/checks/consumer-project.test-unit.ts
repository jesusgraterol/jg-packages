import { describe, expect, test } from 'vitest';

import { listPeerTypePackages } from './consumer-project.ts';
import type { IPackedPackage } from './types.ts';

/**
 * Builds a packed package with only the manifest fields the listing reads.
 * @param name The package's name.
 * @param fields Its peer and dev dependencies.
 * @returns The packed package.
 */
const buildPackage = (
  name: string,
  fields: Pick<IPackedPackage['packedManifest'], 'peerDependencies' | 'devDependencies'>,
): IPackedPackage =>
  ({ packedManifest: { name, version: '0.1.0', ...fields } }) as unknown as IPackedPackage;

describe('listPeerTypePackages', () => {
  test('lists the React types each package with a React peer was tested with, once each', () => {
    expect(
      listPeerTypePackages([
        buildPackage('jg-react', {
          peerDependencies: { react: '^19.2.4' },
          devDependencies: { '@types/react': '19.2.14' },
        }),
        buildPackage('jg-tanstack-query', {
          peerDependencies: { react: '^19.2.4', '@tanstack/react-query': '^5.100.14' },
          devDependencies: { '@types/react': '19.2.14' },
        }),
        buildPackage('jg-fetch', { devDependencies: { '@types/react': '19.2.14' } }),
        buildPackage('jg-utilities', {}),
      ]),
    ).toStrictEqual(['@types/react@19.2.14']);
  });

  test('lists nothing for a React peer without React types to match', () => {
    expect(
      listPeerTypePackages([buildPackage('jg-hooks', { peerDependencies: { react: '^19.0.0' } })]),
    ).toStrictEqual([]);
  });
});
