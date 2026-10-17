import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  DEPENDENCY_FIELDS,
  PRERELEASE_DIST_TAG,
  REGISTRY_POLL_INTERVAL_SECONDS,
  REGISTRY_WAIT_SECONDS,
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
 * Checks whether npm accepted a sibling's version earlier in this run that a range asks for. The
 * packed range of a `workspace:^` sibling is `^` and the sibling's version, so the range names it.
 * @param range The dependent's range, such as `^1.0.1`.
 * @param acceptedVersion The version npm accepted in this run, if any.
 * @returns Whether the range names that version.
 */
const isAcceptedInRun = (range: string, acceptedVersion: string | undefined): boolean =>
  acceptedVersion !== undefined && range.replace(/^[\^~]/, '') === acceptedVersion;

/**
 * Fails when a sibling range in a tarball's manifest has no matching version on npm, or among the
 * versions npm accepted earlier in this run, so a dependent never ships ahead of a sibling.
 * @param runNpm Runs npm.
 * @param manifest The tarball's manifest.
 * @param siblingNames The names of every package in the release.
 * @param accepted The versions npm accepted in this run, by package name.
 * @returns A promise that resolves once every sibling range has a version.
 * @throws
 * - {name}@{version} depends on {dependency}@{range}, which has no version on npm. Release {dependency} first.
 */
const assertSiblingVersions = async (
  runNpm: IPublishDependencies['runNpm'],
  manifest: IPackageManifest,
  siblingNames: Set<string>,
  accepted: Map<string, string>,
): Promise<void> => {
  for (const field of DEPENDENCY_FIELDS) {
    for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
      if (
        siblingNames.has(dependency) &&
        !isAcceptedInRun(range, accepted.get(dependency)) &&
        !(await hasVersion(runNpm, `${dependency}@${range}`))
      ) {
        throw new Error(
          `${manifest.name}@${manifest.version} depends on ${dependency}@${range}, which has no version on npm. Release ${dependency} first.`,
        );
      }
    }
  }
};

/**
 * Publishes one tarball. npm accepts it right away, and serves it a few minutes later.
 * @param releaseDirectory The release directory.
 * @param entry The manifest entry.
 * @param runNpm Runs npm.
 * @returns A promise that resolves once npm accepted the tarball.
 * @throws
 * - npm publish {file} failed: {stderr}
 */
const publishTarball = async (
  releaseDirectory: string,
  { version, file }: IReleaseManifestEntry,
  runNpm: IPublishDependencies['runNpm'],
): Promise<void> => {
  const args = ['publish', join(releaseDirectory, file), '--access', 'public'];
  if (isPrerelease(version)) {
    args.push('--tag', PRERELEASE_DIST_TAG);
  }
  const result = await runNpm(args);
  if (result.exitCode !== 0) {
    throw new Error(`npm publish ${file} failed: ${result.stderr.trim()}`);
  }
};

/**
 * Waits until npm serves every version this run published, for at most REGISTRY_WAIT_SECONDS.
 * @param pending The versions npm accepted in this run.
 * @param dependencies The npm runner, sleep, and logger.
 * @returns A promise that resolves once every version is on npm.
 * @throws
 * - npm accepted {versions} but didn't serve them within {minutes} minutes. Re-run the publish job once they're on npm; it skips and tags them.
 */
const waitForVersions = async (
  pending: IPublishedEntry[],
  { runNpm, sleep, log }: IPublishDependencies,
): Promise<void> => {
  let waiting = pending;
  for (let waitedSeconds = 0; ; waitedSeconds += REGISTRY_POLL_INTERVAL_SECONDS) {
    const stillWaiting: IPublishedEntry[] = [];
    for (const entry of waiting) {
      if (await hasVersion(runNpm, `${entry.name}@${entry.version}`)) {
        log(`${entry.name}@${entry.version} is on npm`);
      } else {
        stillWaiting.push(entry);
      }
    }
    waiting = stillWaiting;
    if (waiting.length === 0) {
      return;
    }
    if (waitedSeconds >= REGISTRY_WAIT_SECONDS) {
      const versions = waiting.map(({ name, version }) => `${name}@${version}`).join(', ');
      throw new Error(
        `npm accepted ${versions} but didn't serve them within ${REGISTRY_WAIT_SECONDS / 60} minutes. Re-run the publish job once they're on npm; it skips and tags them.`,
      );
    }
    await sleep(REGISTRY_POLL_INTERVAL_SECONDS * 1000);
  }
};

/**
 * The `publish` command: publishes a packed release in its manifest's dependency order, then waits
 * until npm serves every version it published. Versions already on npm are skipped, so a re-run is
 * safe; packages that aren't on npm yet are skipped with a warning, because their first publish is
 * manual; prereleases go to the `next` dist-tag. Writes `published.json` to the release
 * directory, listing every version of the release that's on npm, including those an earlier run
 * published, so `tag` tags whatever is still untagged.
 * @param releaseDirectory The directory `pack` wrote.
 * @param dependencies The npm runner, sleep, and logger.
 * @returns A promise that resolves to the release's versions that are on npm.
 * @throws
 * - The release manifest is not a list of tarball entries: {path}
 * - The tarball doesn't match the release manifest checksum: {file}
 * - {name}@{version} depends on {dependency}@{range}, which has no version on npm. Release {dependency} first.
 * - npm publish {file} failed: {stderr}
 * - npm accepted {versions} but didn't serve them within {minutes} minutes. Re-run the publish job once they're on npm; it skips and tags them.
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
  const released: IPublishedEntry[] = [];
  const accepted = new Map<string, string>();
  for (const entry of entries) {
    const { name, version, file } = entry;
    if (await hasVersion(runNpm, `${name}@${version}`)) {
      log(`Skipped ${name}@${version}: already on npm`);
      released.push({ name, version });
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
    await assertSiblingVersions(runNpm, manifest, siblingNames, accepted);
    await publishTarball(releaseDirectory, entry, runNpm);
    log(`Published ${name}@${version}`);
    accepted.set(name, version);
    released.push({ name, version });
  }
  await waitForVersions(
    [...accepted].map(([name, version]) => ({ name, version })),
    dependencies,
  );
  const publishedFile = await writePublishedEntries(releaseDirectory, released);
  log(
    `Wrote ${released.length} versions on npm, ${accepted.size} of them new, to ${publishedFile}`,
  );
  return released;
};
