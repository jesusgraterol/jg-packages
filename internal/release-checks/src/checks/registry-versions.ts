import { isDeepStrictEqual } from 'node:util';
import semver from 'semver';

import { DEPENDENCY_FIELDS } from '../shared/constants.ts';
import { sha256 } from '../shared/release-files.ts';
import { readTarballFiles } from '../shared/tarball.ts';
import { isPrerelease } from '../shared/versions.ts';
import type { IPackageManifest } from '../shared/types.ts';
import type { IPackedPackage, IRegistry, IRegistryPackage } from './types.ts';

/**
 * Prepares two manifests for comparison. Fields consumers never use, `devDependencies` and
 * `scripts`, are removed from both. A sibling range that differs is replaced by the published
 * one when the published range still covers the sibling's current version, because
 * `workspace:^` packs as `^<current version>` and a sibling's release alone shouldn't force a
 * release of its dependents.
 * @param packed The manifest as it would ship now.
 * @param published The manifest of the published tarball.
 * @param siblingVersions The current version of every workspace package, by name.
 * @returns Both manifests, ready for a deep comparison.
 */
export const normalizeManifests = (
  packed: IPackageManifest,
  published: IPackageManifest,
  siblingVersions: Map<string, string>,
): [IPackageManifest, IPackageManifest] => {
  const strip = (manifest: IPackageManifest): IPackageManifest => {
    const copy = structuredClone(manifest);
    delete copy.devDependencies;
    delete copy.scripts;
    return copy;
  };
  const normalizedPacked = strip(packed);
  const normalizedPublished = strip(published);
  for (const field of DEPENDENCY_FIELDS) {
    const packedRanges = normalizedPacked[field];
    const publishedRanges = normalizedPublished[field];
    if (packedRanges === undefined || publishedRanges === undefined) {
      continue;
    }
    for (const [dependency, range] of Object.entries(packedRanges)) {
      const currentVersion = siblingVersions.get(dependency);
      const publishedRange = publishedRanges[dependency];
      if (
        currentVersion !== undefined &&
        publishedRange !== undefined &&
        publishedRange !== range &&
        semver.satisfies(currentVersion, publishedRange)
      ) {
        packedRanges[dependency] = publishedRange;
      }
    }
  }
  return [normalizedPacked, normalizedPublished];
};

/**
 * Lists the files whose contents differ between the packed and the published tarball, comparing
 * SHA-256 hashes of the extracted files, so gzip and timestamp differences don't count.
 * @param packedFiles The files the package would ship now.
 * @param publishedFiles The files of the published version.
 * @param siblingVersions The current version of every workspace package, by name.
 * @returns The changed, added, or removed paths, sorted.
 */
export const findChangedFiles = (
  packedFiles: Map<string, Buffer>,
  publishedFiles: Map<string, Buffer>,
  siblingVersions: Map<string, string>,
): string[] => {
  const paths = new Set([...packedFiles.keys(), ...publishedFiles.keys()]);
  return [...paths]
    .filter((path) => {
      const packed = packedFiles.get(path);
      const published = publishedFiles.get(path);
      if (packed === undefined || published === undefined) {
        return true;
      }
      if (path === 'package.json') {
        const [left, right] = normalizeManifests(
          JSON.parse(packed.toString('utf8')) as IPackageManifest,
          JSON.parse(published.toString('utf8')) as IPackageManifest,
          siblingVersions,
        );
        return !isDeepStrictEqual(left, right);
      }
      return sha256(packed) !== sha256(published);
    })
    .sort();
};

/**
 * Lists a manifest's ranges on workspace siblings.
 * @param manifest The packed manifest.
 * @param siblingVersions The current version of every workspace package, by name.
 * @returns Each sibling dependency with its range.
 */
const getSiblingRanges = (
  manifest: IPackageManifest,
  siblingVersions: Map<string, string>,
): [string, string][] =>
  DEPENDENCY_FIELDS.flatMap((field) =>
    Object.entries(manifest[field] ?? {}).filter(([dependency]) => siblingVersions.has(dependency)),
  );

/**
 * Check 7: compares every package that's already on npm with the registry. An unchanged version
 * must ship exactly the published files; a new version must be higher than its dist-tag, and
 * every sibling range must have a version on npm or in the same release. Packages that aren't
 * on npm yet are skipped until their manual first publish.
 * @param packages The packed packages of the release.
 * @param registry Read access to the registry.
 * @returns A promise that resolves to each package's problems, by name.
 */
export const checkRegistryVersions = async (
  packages: IPackedPackage[],
  registry: IRegistry,
): Promise<Map<string, string[]>> => {
  const siblingVersions = new Map(
    packages.map(({ packedManifest }) => [packedManifest.name, packedManifest.version]),
  );
  const registryPackages = new Map<string, IRegistryPackage | undefined>();
  for (const { packedManifest } of packages) {
    registryPackages.set(packedManifest.name, await registry.getPackage(packedManifest.name));
  }
  // packages CI would publish in this release: on npm, with an unpublished version
  const releasing = new Set(
    packages
      .filter(({ packedManifest }) => {
        const registryPackage = registryPackages.get(packedManifest.name);
        return (
          registryPackage !== undefined &&
          !registryPackage.versions.includes(packedManifest.version)
        );
      })
      .map(({ packedManifest }) => packedManifest.name),
  );

  const problems = new Map<string, string[]>();
  for (const { packedManifest, files } of packages) {
    const { name, version } = packedManifest;
    const registryPackage = registryPackages.get(name);
    const packageProblems: string[] = [];
    problems.set(name, packageProblems);
    if (registryPackage === undefined) {
      continue;
    }
    if (registryPackage.versions.includes(version)) {
      const publishedFiles = await readTarballFiles(await registry.downloadTarball(name, version));
      const changed = findChangedFiles(files, publishedFiles, siblingVersions);
      if (changed.length > 0) {
        packageProblems.push(
          `contents changed without a version bump (${version} is already on npm): ${changed.join(', ')}`,
        );
      }
      continue;
    }
    const distTag =
      isPrerelease(version) && registryPackage.distTags['next'] !== undefined ? 'next' : 'latest';
    const taggedVersion = registryPackage.distTags[distTag];
    if (taggedVersion !== undefined && !semver.gt(version, taggedVersion)) {
      packageProblems.push(
        `version ${version} isn't higher than the published ${distTag} version ${taggedVersion}`,
      );
    }
    for (const [dependency, range] of getSiblingRanges(packedManifest, siblingVersions)) {
      const isOnNpm = (registryPackages.get(dependency)?.versions ?? []).some((candidate) =>
        semver.satisfies(candidate, range),
      );
      const isInRelease =
        releasing.has(dependency) && semver.satisfies(siblingVersions.get(dependency) ?? '', range);
      if (!isOnNpm && !isInRelease) {
        packageProblems.push(
          `depends on ${dependency}@${range}, which has no matching version on npm or in this release`,
        );
      }
    }
  }
  return problems;
};
