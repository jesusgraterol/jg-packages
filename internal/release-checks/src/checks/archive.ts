import { inspectNpmTarball } from 'jg-package-check';

import { MAX_TARBALL_BYTES, MAX_TARBALL_ENTRIES } from '../shared/constants.ts';

/**
 * Applies the release workspace's artifact limits to a local or registry tarball.
 * @param compressed The bounded gzip bytes.
 * @returns The exact package-relative paths and bytes.
 * @throws
 * - INVALID_NPM_TARBALL: The npm tarball is invalid.
 */
export const inspectReleaseArchive = (compressed: Buffer): Promise<Map<string, Buffer>> =>
  inspectNpmTarball(compressed, {
    compressedBytes: MAX_TARBALL_BYTES,
    expandedBytes: MAX_TARBALL_BYTES,
    entryBytes: MAX_TARBALL_BYTES,
    entries: MAX_TARBALL_ENTRIES,
  });
