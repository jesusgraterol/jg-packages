import { createHash } from 'node:crypto';

import { Exception } from 'jg-exception';

import { ERRORS } from '../../shared/index.js';

import { readStableFile } from './stable-file.js';
import type { IFileHash, IHashFileOptions } from './types.js';

/**
 * Computes the size and SHA-256 digest of one regular file with bounded memory. Rejects detectable
 * changes to the file or its path during the read. POSIX opens the last component atomically
 * without following links. Windows checks the path before opening and compares it with the opened
 * descriptor before and after reading. The caller owns containment of parent directories.
 * Cancellation rejects with the caller's abort reason.
 * @param path The file's path.
 * @param options An optional maximum size in bytes and cancellation signal.
 * @returns A promise that resolves to the size and lowercase digest of the content read.
 * @example
 * import { hashFile } from 'jg-fs';
 *
 * const identity = await hashFile('inbox/asset.bin', { maxBytes: 16 * 1024 * 1024 });
 * @throws
 * - INVALID_FILE_SIZE_LIMIT: The file size limit must be a non-negative safe integer.
 * - NON_EXISTENT_FILE: The file '<path>' does not exist.
 * - NOT_A_FILE: The file '<path>' is a symbolic link.
 * - NOT_A_FILE: The path '<path>' is not a file.
 * - FILE_TOO_LARGE: The file '<path>' is larger than <maxBytes> bytes.
 * - FILE_CHANGED: The file '<path>' changed since it was read.
 */
export const hashFile = async (
  path: string,
  options: IHashFileOptions = {},
): Promise<IFileHash> => {
  const { maxBytes } = options;
  if (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes < 0)) {
    throw new Exception('The file size limit must be a non-negative safe integer.', {
      code: ERRORS.INVALID_FILE_SIZE_LIMIT,
    });
  }

  const digest = createHash('sha256');
  const size = await readStableFile(path, options, (chunk) => {
    digest.update(chunk);
  });
  return { size, sha256: digest.digest('hex') };
};
