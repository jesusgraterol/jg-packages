import { describe, expect, test } from 'vitest';

import { createTarball } from '../test-utils/tarball.ts';
import { checkRegistryVersions } from './registry-versions.ts';
import type { IPackageManifest } from '../shared/types.ts';
import type { IPackedPackage, IRegistry, IRegistryPackage } from './types.ts';

const UTILS_MANIFEST: IPackageManifest = {
  name: 'jg-utils',
  version: '1.0.0',
  dependencies: { 'jg-exception': '^1.0.0', uuid: '^14.0.3' },
  devDependencies: { vitest: '5.0.5' },
  scripts: { build: 'tsc' },
};

const UTILS_FILES = { 'dist/index.js': 'export const a = 1;\n', 'README.md': '# jg-utils\n' };

// builds a packed package from its manifest and files
const packed = (manifest: IPackageManifest, files: Record<string, string>): IPackedPackage => ({
  workspacePackage: {
    name: manifest.name,
    version: manifest.version,
    directory: `/repo/packages/${manifest.name}`,
    manifest,
  },
  tarballPath: `/release/${manifest.name}-${manifest.version}.tgz`,
  sha256: 'not-checked',
  files: new Map(
    Object.entries({ ...files, 'package.json': JSON.stringify(manifest) }).map(
      ([path, contents]) => [path, Buffer.from(contents)],
    ),
  ),
  packedManifest: manifest,
});

// a registry holding the given packages and the tarballs of their published versions
const fakeRegistry = (
  packages: Record<string, IRegistryPackage>,
  tarballs: Record<string, { manifest: IPackageManifest; files: Record<string, string> }> = {},
): IRegistry => ({
  getPackage: (name) => Promise.resolve(packages[name]),
  downloadTarball: (name, version) => {
    // jg-exception ships only its manifest in these tests
    const published =
      tarballs[`${name}@${version}`] ??
      (name === 'jg-exception' ? { manifest: { name, version }, files: {} } : undefined);
    if (published === undefined) {
      return Promise.reject(new Error(`no tarball for ${name}@${version}`));
    }
    return Promise.resolve(
      createTarball({ ...published.files, 'package.json': JSON.stringify(published.manifest) }),
    );
  },
});

// the registry state after jg-exception 1.0.0 and jg-utils 1.0.0 were published
const publishedRegistry = (exceptionVersions = ['1.0.0'], latestException = '1.0.0'): IRegistry =>
  fakeRegistry(
    {
      'jg-exception': { versions: exceptionVersions, distTags: { latest: latestException } },
      'jg-utils': { versions: ['1.0.0'], distTags: { latest: '1.0.0' } },
    },
    { 'jg-utils@1.0.0': { manifest: UTILS_MANIFEST, files: UTILS_FILES } },
  );

// the jg-exception package at a version
const exception = (version: string): IPackedPackage =>
  packed({ name: 'jg-exception', version }, {});

describe('checkRegistryVersions: an unchanged version', () => {
  test('passes when the files match the published tarball', async () => {
    const problems = await checkRegistryVersions(
      [exception('1.0.0'), packed(UTILS_MANIFEST, UTILS_FILES)],
      publishedRegistry(),
    );

    expect(problems.get('jg-utils')).toStrictEqual([]);
  });

  test('fails when a shipped file changed without a version bump', async () => {
    const problems = await checkRegistryVersions(
      [
        exception('1.0.0'),
        packed(UTILS_MANIFEST, {
          ...UTILS_FILES,
          'dist/index.js': 'export const a = 2;\n',
          'dist/new.js': '',
        }),
      ],
      publishedRegistry(),
    );

    expect(problems.get('jg-utils')).toStrictEqual([
      'contents changed without a version bump (1.0.0 is already on npm): dist/index.js, dist/new.js',
    ]);
  });

  test('passes when only devDependencies or scripts changed', async () => {
    const manifest = {
      ...UTILS_MANIFEST,
      devDependencies: { vitest: '5.0.6' },
      scripts: { build: 'tsc -b', test: 'vitest' },
    };

    const problems = await checkRegistryVersions(
      [exception('1.0.0'), packed(manifest, UTILS_FILES)],
      publishedRegistry(),
    );

    expect(problems.get('jg-utils')).toStrictEqual([]);
  });

  test('fails when another manifest field changed', async () => {
    const manifest = {
      ...UTILS_MANIFEST,
      dependencies: { ...UTILS_MANIFEST.dependencies, uuid: '^15.0.0' },
    };

    const problems = await checkRegistryVersions(
      [exception('1.0.0'), packed(manifest, UTILS_FILES)],
      publishedRegistry(),
    );

    expect(problems.get('jg-utils')).toStrictEqual([
      'contents changed without a version bump (1.0.0 is already on npm): package.json',
    ]);
  });

  test("passes when a sibling's minor release is still inside the published range", async () => {
    const manifest = {
      ...UTILS_MANIFEST,
      dependencies: { ...UTILS_MANIFEST.dependencies, 'jg-exception': '^1.1.0' },
    };

    const problems = await checkRegistryVersions(
      [exception('1.1.0'), packed(manifest, UTILS_FILES)],
      publishedRegistry(['1.0.0'], '1.0.0'),
    );

    expect(problems.get('jg-utils')).toStrictEqual([]);
    expect(problems.get('jg-exception')).toStrictEqual([]);
  });

  test("fails when a sibling's new major is outside the published range", async () => {
    const manifest = {
      ...UTILS_MANIFEST,
      dependencies: { ...UTILS_MANIFEST.dependencies, 'jg-exception': '^2.0.0' },
    };

    const problems = await checkRegistryVersions(
      [exception('2.0.0'), packed(manifest, UTILS_FILES)],
      publishedRegistry(),
    );

    expect(problems.get('jg-utils')).toStrictEqual([
      'contents changed without a version bump (1.0.0 is already on npm): package.json',
    ]);
  });
});

describe('checkRegistryVersions: a new version', () => {
  test('passes when it is higher than latest and its siblings are on npm', async () => {
    const problems = await checkRegistryVersions(
      [exception('1.0.0'), packed({ ...UTILS_MANIFEST, version: '1.1.0' }, UTILS_FILES)],
      publishedRegistry(),
    );

    expect(problems.get('jg-utils')).toStrictEqual([]);
  });

  test('fails when it is not higher than latest', async () => {
    const registry = fakeRegistry({
      'jg-utils': { versions: ['1.0.0', '1.2.0'], distTags: { latest: '1.2.0' } },
    });

    const problems = await checkRegistryVersions(
      [packed({ name: 'jg-utils', version: '1.1.0' }, {})],
      registry,
    );

    expect(problems.get('jg-utils')).toStrictEqual([
      "version 1.1.0 isn't higher than the published latest version 1.2.0",
    ]);
  });

  test('compares a prerelease with the next dist-tag', async () => {
    const registry = fakeRegistry({
      'jg-utils': {
        versions: ['1.0.0', '1.1.0-beta.1'],
        distTags: { latest: '1.0.0', next: '1.1.0-beta.1' },
      },
    });

    const problems = await checkRegistryVersions(
      [packed({ name: 'jg-utils', version: '1.1.0-beta.0' }, {})],
      registry,
    );

    expect(problems.get('jg-utils')).toStrictEqual([
      "version 1.1.0-beta.0 isn't higher than the published next version 1.1.0-beta.1",
    ]);
  });

  test('passes when a sibling range is satisfied by a sibling released together', async () => {
    const manifest = {
      ...UTILS_MANIFEST,
      version: '1.1.0',
      dependencies: { 'jg-exception': '^1.1.0' },
    };

    const problems = await checkRegistryVersions(
      [exception('1.1.0'), packed(manifest, UTILS_FILES)],
      publishedRegistry(),
    );

    expect(problems.get('jg-utils')).toStrictEqual([]);
  });

  test('fails when a sibling range has no version on npm or in the release', async () => {
    const registry = fakeRegistry({
      'jg-exception': { versions: ['1.0.0'], distTags: { latest: '1.0.0' } },
      'jg-utils': { versions: ['1.0.0'], distTags: { latest: '1.0.0' } },
    });
    const manifest = {
      name: 'jg-utils',
      version: '1.1.0',
      dependencies: { 'jg-exception': '^2.0.0' },
    };

    const problems = await checkRegistryVersions(
      [exception('1.0.0'), packed(manifest, {})],
      registry,
    );

    expect(problems.get('jg-utils')).toStrictEqual([
      'depends on jg-exception@^2.0.0, which has no matching version on npm or in this release',
    ]);
  });

  test("doesn't count a sibling that isn't on npm yet, because CI skips its first publish", async () => {
    const registry = fakeRegistry({
      'jg-utils': { versions: ['1.0.0'], distTags: { latest: '1.0.0' } },
    });
    const manifest = {
      name: 'jg-utils',
      version: '1.1.0',
      dependencies: { 'jg-exception': '^1.0.0' },
    };

    const problems = await checkRegistryVersions(
      [exception('1.0.0'), packed(manifest, {})],
      registry,
    );

    expect(problems.get('jg-utils')).toStrictEqual([
      'depends on jg-exception@^1.0.0, which has no matching version on npm or in this release',
    ]);
    expect(problems.get('jg-exception')).toStrictEqual([]);
  });
});
