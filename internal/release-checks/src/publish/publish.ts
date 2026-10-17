import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  DEPENDENCY_FIELDS,
  PRERELEASE_DIST_TAG,
  REGISTRY_POLL_ATTEMPTS,
  REGISTRY_POLL_INTERVAL_SECONDS,
} from '../shared/constants.ts';
import { readReleaseManifest, sha256, writePublishedEntries } from '../shared/release-files.ts';
import { readTarballFiles } from '../shared/tarball.ts';
import { isPrerelease } from '../shared/versions.ts';
import type {
  ICommandResult,
  IPackageManifest,
  IPublishedEntry,
  IReleaseManifestEntry,
} from '../shared/types.ts';

/*
 * This module runs in the CI job that holds `id-token: write`, which installs no dependencies, so
 * it and everything it imports use only Node.js built-ins. A unit test enforces it.
 */

// what the publish command needs from its environment
export type IPublishDependencies = {
  runNpm: (args: string[]) => Promise<ICommandResult>;
  sleep: (milliseconds: number) => Promise<void>;
  log: (message: string) => void;
};

/**
 * Checks whether npm has a version, or a version matching a range.
 * @param runNpm Runs npm.
 * @param spec A package spec, such as `jg-utilities@1.0.0` or `jg-utilities@^1.0.0`.
 * @returns A promise that resolves to whether a matching version exists.
 * @throws
 * - npm view {spec} failed: {stderr}
 */
const hasVersion = async (
  runNpm: IPublishDependencies['runNpm'],
  spec: string,
): Promise<boolean> => {
  const result = await runNpm(['view', spec, 'version', '--json']);
  if (result.exitCode !== 0) {
    if (result.stderr.includes('E404')) {
      return false;
    }
    throw new Error(`npm view ${spec} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim() !== '';
};

/**
 * Checks each tarball against the SHA-256 the manifest recorded, so the published bytes are the
 * ones the checks ran against.
 * @param releaseDirectory The release directory.
 * @param entries The manifest entries.
 * @returns A promise that resolves once every tarball matches.
 * @throws
 * - The tarball doesn't match the release manifest checksum: {file}
 */
const verifyChecksums = async (
  releaseDirectory: string,
  entries: IReleaseManifestEntry[],
): Promise<void> => {
  for (const { file, sha256: expected } of entries) {
    if (sha256(await readFile(join(releaseDirectory, file))) !== expected) {
      throw new Error(`The tarball doesn't match the release manifest checksum: ${file}`);
    }
  }
};

/**
 * Fails when a sibling range in a tarball's manifest has no matching version on npm, counting
 * versions published earlier in the same run, so a dependent never ships ahead of a sibling.
 * @param runNpm Runs npm.
 * @param manifest The tarball's manifest.
 * @param siblingNames The names of every package in the release.
 * @returns A promise that resolves once every sibling range has a version.
 * @throws
 * - {name}@{version} depends on {dependency}@{range}, which has no version on npm. Release {dependency} first.
 */
const assertSiblingVersions = async (
  runNpm: IPublishDependencies['runNpm'],
  manifest: IPackageManifest,
  siblingNames: Set<string>,
): Promise<void> => {
  for (const field of DEPENDENCY_FIELDS) {
    for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
      if (siblingNames.has(dependency) && !(await hasVersion(runNpm, `${dependency}@${range}`))) {
        throw new Error(
          `${manifest.name}@${manifest.version} depends on ${dependency}@${range}, which has no version on npm. Release ${dependency} first.`,
        );
      }
    }
  }
};

/**
 * Publishes one tarball and waits until the registry serves the new version.
 * @param releaseDirectory The release directory.
 * @param entry The manifest entry.
 * @param dependencies The npm runner, sleep, and logger.
 * @returns A promise that resolves once npm serves the version.
 * @throws
 * - npm publish {file} failed: {stderr}
 * - {name}@{version} didn't appear on the registry after publishing.
 */
const publishTarball = async (
  releaseDirectory: string,
  { name, version, file }: IReleaseManifestEntry,
  { runNpm, sleep, log }: IPublishDependencies,
): Promise<void> => {
  const args = ['publish', join(releaseDirectory, file), '--access', 'public'];
  if (isPrerelease(version)) {
    args.push('--tag', PRERELEASE_DIST_TAG);
  }
  const result = await runNpm(args);
  if (result.exitCode !== 0) {
    throw new Error(`npm publish ${file} failed: ${result.stderr.trim()}`);
  }
  for (let attempt = 1; attempt <= REGISTRY_POLL_ATTEMPTS; attempt += 1) {
    if (await hasVersion(runNpm, `${name}@${version}`)) {
      log(`Published ${name}@${version}`);
      return;
    }
    if (attempt < REGISTRY_POLL_ATTEMPTS) {
      await sleep(REGISTRY_POLL_INTERVAL_SECONDS * 1000);
    }
  }
  throw new Error(`${name}@${version} didn't appear on the registry after publishing.`);
};

/**
 * The `publish` command: publishes a packed release in its manifest's dependency order. Versions
 * already on npm are skipped, so a re-run is safe; packages that aren't on npm yet are skipped
 * with a warning, because their first publish is manual; prereleases go to the `next` dist-tag.
 * Writes `published.json` to the release directory.
 * @param releaseDirectory The directory `pack` wrote.
 * @param dependencies The npm runner, sleep, and logger.
 * @returns A promise that resolves to the versions this run published.
 * @throws
 * - The release manifest is not a list of tarball entries: {path}
 * - The tarball doesn't match the release manifest checksum: {file}
 * - {name}@{version} depends on {dependency}@{range}, which has no version on npm. Release {dependency} first.
 * - npm publish {file} failed: {stderr}
 * - {name}@{version} didn't appear on the registry after publishing.
 * - npm view {spec} failed: {stderr}
 */
export const publishRelease = async (
  releaseDirectory: string,
  dependencies: IPublishDependencies,
): Promise<IPublishedEntry[]> => {
  const { runNpm, log } = dependencies;
  const entries = await readReleaseManifest(releaseDirectory);
  await verifyChecksums(releaseDirectory, entries);
  const siblingNames = new Set(entries.map(({ name }) => name));
  const published: IPublishedEntry[] = [];
  for (const entry of entries) {
    const { name, version, file } = entry;
    if (await hasVersion(runNpm, `${name}@${version}`)) {
      log(`Skipped ${name}@${version}: already on npm`);
      continue;
    }
    if (!(await hasVersion(runNpm, name))) {
      log(
        `Warning: skipped ${name}@${version}: ${name} isn't on npm yet, and its first publish is manual`,
      );
      continue;
    }
    const files = await readTarballFiles(join(releaseDirectory, file));
    const manifest = JSON.parse(
      files.get('package.json')?.toString('utf8') ?? '{}',
    ) as IPackageManifest;
    await assertSiblingVersions(runNpm, manifest, siblingNames);
    await publishTarball(releaseDirectory, entry, dependencies);
    published.push({ name, version });
  }
  const publishedFile = await writePublishedEntries(releaseDirectory, published);
  log(`Wrote ${published.length} published versions to ${publishedFile}`);
  return published;
};
