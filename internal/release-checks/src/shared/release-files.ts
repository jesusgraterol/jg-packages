import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PUBLISHED_FILE, RELEASE_MANIFEST_FILE } from './constants.ts';
import type { IPublishedEntry, IReleaseManifestEntry } from './types.ts';

/**
 * Hashes bytes with SHA-256.
 * @param contents The bytes to hash.
 * @returns The lowercase hexadecimal digest.
 */
export const sha256 = (contents: Buffer): string =>
  createHash('sha256').update(contents).digest('hex');

/**
 * Checks that a parsed value is a list of objects whose listed fields are all strings.
 * @param value The parsed JSON.
 * @param fields The fields every item needs.
 * @returns Whether the value has that shape.
 */
const isListOf = <TField extends string>(
  value: unknown,
  fields: TField[],
): value is Record<TField, string>[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      fields.every((field) => typeof (item as Record<string, unknown>)[field] === 'string'),
  );

/**
 * Reads a release directory's manifest.
 * @param releaseDirectory The directory `pack` wrote.
 * @returns A promise that resolves to the tarballs in publish order.
 * @throws
 * - The release manifest is not a list of tarball entries: {path}
 */
export const readReleaseManifest = async (
  releaseDirectory: string,
): Promise<IReleaseManifestEntry[]> => {
  const path = join(releaseDirectory, RELEASE_MANIFEST_FILE);
  const manifest: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!isListOf(manifest, ['name', 'version', 'file', 'sha256'])) {
    throw new Error(`The release manifest is not a list of tarball entries: ${path}`);
  }
  return manifest.map(({ name, version, file, sha256: digest }) => ({
    name,
    version,
    file,
    sha256: digest,
  }));
};

/**
 * Writes a release directory's manifest.
 * @param releaseDirectory The directory holding the tarballs.
 * @param entries The tarballs in publish order.
 * @returns A promise that resolves once the file is written.
 */
export const writeReleaseManifest = async (
  releaseDirectory: string,
  entries: IReleaseManifestEntry[],
): Promise<void> => {
  await writeFile(
    join(releaseDirectory, RELEASE_MANIFEST_FILE),
    `${JSON.stringify(entries, null, 2)}\n`,
  );
};

/**
 * Reads the versions a publish run put on npm.
 * @param path The `published.json` file.
 * @returns A promise that resolves to the published versions.
 * @throws
 * - The published file is not a list of package versions: {path}
 */
export const readPublishedEntries = async (path: string): Promise<IPublishedEntry[]> => {
  const published: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!isListOf(published, ['name', 'version'])) {
    throw new Error(`The published file is not a list of package versions: ${path}`);
  }
  return published.map(({ name, version }) => ({ name, version }));
};

/**
 * Writes the versions a publish run put on npm into the release directory.
 * @param releaseDirectory The release directory.
 * @param entries The published versions.
 * @returns A promise that resolves to the file's path.
 */
export const writePublishedEntries = async (
  releaseDirectory: string,
  entries: IPublishedEntry[],
): Promise<string> => {
  const path = join(releaseDirectory, PUBLISHED_FILE);
  await writeFile(path, `${JSON.stringify(entries, null, 2)}\n`);
  return path;
};
