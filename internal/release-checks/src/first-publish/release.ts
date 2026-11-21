import { join } from 'node:path';

import { assertNoLinksBelow, readBoundedFile } from 'jg-fs';
import { getRemoteUrl, isAncestor, isWorkingTreeClean, resolveCommit } from 'jg-git-commands';
import { prerelease, valid } from 'semver';

import { RELEASE_MANIFEST_FILE } from '../shared/constants.ts';
import { parseReleaseManifest, sha256 } from '../shared/release-files.ts';

import { PACKAGE_NAME, SHA256 } from './options.ts';
import type { IFirstPublishOptions } from './types.ts';

const MANIFEST_MAX_BYTES = 256 * 1024;
const CANONICAL_ORIGIN =
  /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)jesusgraterol\/jg-packages(?:\.git)?$/i;

/**
 * Qualifies the current checkout and verifies the exact manifest before parsing its entries.
 * @param root The repository executing the first-publish command.
 * @param options The approved source, artifact and selections.
 * @returns The release directory and selected entries in manifest order.
 */
export const qualifyRelease = async (root: string, options: IFirstPublishOptions) => {
  if (!CANONICAL_ORIGIN.test(await getRemoteUrl(root))) {
    throw new Error('The first-publish checkout must use the canonical jg-packages origin.');
  }
  const head = await resolveCommit(root, 'HEAD');
  if (
    head !== options.sourceCommit ||
    !(await isWorkingTreeClean(root)) ||
    !(await isAncestor(root, options.sourceCommit, 'refs/remotes/origin/main'))
  ) {
    throw new Error('Use a clean checkout of the approved commit on the refreshed origin/main.');
  }
  const directory = join(root, '.release');
  const path = join(directory, RELEASE_MANIFEST_FILE);
  await assertNoLinksBelow(root, path);
  const contents = await readBoundedFile(path, MANIFEST_MAX_BYTES);
  if (sha256(contents) !== options.manifestSha256) {
    throw new Error('The release manifest SHA-256 does not match the approved CI artifact.');
  }
  const manifest = parseReleaseManifest(contents.toString('utf8'), path);
  const entries = manifest.filter(({ name }) => options.packages.includes(name));
  if (
    entries.length !== options.packages.length ||
    new Set(entries.map(({ name }) => name)).size !== entries.length ||
    new Set(entries.map(({ file }) => file)).size !== entries.length ||
    entries.some(
      ({ file, name, version, sha256: digest }) =>
        !PACKAGE_NAME.test(name) ||
        valid(version) !== version ||
        prerelease(version) !== null ||
        file !== `${name}-${version}.tgz` ||
        file.length > 64 ||
        !SHA256.test(digest),
    )
  ) {
    throw new Error('The selected release entries must identify unique, portable stable tarballs.');
  }
  return { directory, entries, manifest };
};
