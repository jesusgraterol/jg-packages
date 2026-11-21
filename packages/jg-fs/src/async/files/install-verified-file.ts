import { randomUUID } from 'node:crypto';
import { link, open, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { Exception, getErrorCode } from 'jg-exception';

import { ERRORS, fileAlreadyExists, PRIVATE_FILE_MODE } from '../../shared/index.js';

import { hashFile } from './hash-file.js';
import { readStableFile } from './stable-file.js';
import type { IFileHash, IHashFileOptions } from './types.js';

const matchesHash = (actual: IFileHash, expected: IFileHash): boolean =>
  actual.size === expected.size && actual.sha256 === expected.sha256;

const contentMismatch = (): Exception =>
  new Exception('The file does not match the expected size and SHA-256 digest.', {
    code: ERRORS.FILE_CONTENT_MISMATCH,
  });

/**
 * Gets a stable destination hash, rechecking once if another installer unlinks its staging alias
 * during the read. Unlinking changes the inode's change time even when the contents are intact.
 * @param path The destination.
 * @param options The validated size and cancellation options.
 * @returns A promise that resolves to the destination hash.
 * @throws
 * - NON_EXISTENT_FILE: The file '<path>' does not exist.
 * - NOT_A_FILE: The file '<path>' is a symbolic link.
 * - NOT_A_FILE: The path '<path>' is not a file.
 * - FILE_TOO_LARGE: The file '<path>' is larger than <maxBytes> bytes.
 * - FILE_CHANGED: The file '<path>' changed since it was read.
 */
const hashMatchingDestination = async (
  path: string,
  options: IHashFileOptions,
): Promise<IFileHash> => {
  try {
    return await hashFile(path, options);
  } catch (error) {
    options.signal?.throwIfAborted();
    if (getErrorCode(error) !== ERRORS.FILE_CHANGED) {
      throw error;
    }
  }
  return hashFile(path, options);
};

/**
 * Checks whether an existing destination can be reused.
 * @param path The destination.
 * @param expected Its expected identity.
 * @param signal The optional cancellation signal.
 * @returns A promise that resolves to whether a matching destination exists.
 * @throws
 * - FILE_ALREADY_EXISTS: The file '<path>' already exists.
 * - FILE_CHANGED: The file '<path>' changed since it was read.
 */
const hasMatchingFile = async (
  path: string,
  expected: IFileHash,
  signal: AbortSignal | undefined,
): Promise<boolean> => {
  try {
    const actual = await hashMatchingDestination(path, { maxBytes: expected.size, signal });
    if (!matchesHash(actual, expected)) {
      throw fileAlreadyExists(path);
    }
    return true;
  } catch (error) {
    if (signal?.aborted && error === signal.reason) {
      throw error;
    }
    const code = getErrorCode(error);
    if (code === ERRORS.NON_EXISTENT_FILE) {
      return false;
    }
    if (code === ERRORS.NOT_A_FILE || code === ERRORS.FILE_TOO_LARGE) {
      throw fileAlreadyExists(path);
    }
    throw error;
  }
};

/**
 * Installs the expected file by linking an exclusively staged and verified copy to the destination.
 * A matching destination is reused. Other occupants remain in place. The parent directory must
 * exist, be controlled by the caller, and support hard links. Cancellation before installation
 * preserves the destination and rejects with the caller's reason. File identity and link checks
 * are the same as for hashFile.
 * @param source The input file.
 * @param destination The new path.
 * @param expected The required byte size and lowercase SHA-256 digest.
 * @param options An optional cancellation signal.
 * @returns A promise that resolves once the expected file is installed or reused.
 * @example
 * import { hashFile, installVerifiedFile } from 'jg-fs';
 *
 * const source = 'inbox/asset.bin';
 * const identity = await hashFile(source);
 * await installVerifiedFile(source, 'assets/asset.bin', identity);
 * @throws
 * - INVALID_FILE_IDENTITY: The expected file identity must contain a non-negative safe integer size and a lowercase SHA-256 digest.
 * - FILE_CONTENT_MISMATCH: The file does not match the expected size and SHA-256 digest.
 * - NON_EXISTENT_FILE: The file '<path>' does not exist.
 * - NOT_A_FILE: The file '<path>' is a symbolic link.
 * - NOT_A_FILE: The path '<path>' is not a file.
 * - FILE_ALREADY_EXISTS: The file '<path>' already exists.
 * - FILE_CHANGED: The file '<path>' changed since it was read.
 */
export const installVerifiedFile = async (
  source: string,
  destination: string,
  expected: IFileHash,
  { signal }: Pick<IHashFileOptions, 'signal'> = {},
): Promise<void> => {
  const size = expected?.size;
  const sha256 = expected?.sha256;
  if (
    typeof size !== 'number' ||
    !Number.isSafeInteger(size) ||
    size < 0 ||
    typeof sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(sha256)
  ) {
    throw new Exception(
      'The expected file identity must contain a non-negative safe integer size and a lowercase SHA-256 digest.',
      { code: ERRORS.INVALID_FILE_IDENTITY },
    );
  }
  const identity = { size, sha256 };
  if (await hasMatchingFile(destination, identity, signal)) {
    return;
  }

  signal?.throwIfAborted();
  const temporary = join(dirname(destination), `.${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', PRIVATE_FILE_MODE);
  try {
    try {
      await readStableFile(source, { maxBytes: size, signal }, (chunk) => handle.writeFile(chunk));
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (!matchesHash(await hashFile(temporary, { maxBytes: size, signal }), identity)) {
      throw contentMismatch();
    }

    signal?.throwIfAborted();
    try {
      await link(temporary, destination);
    } catch (error) {
      if (
        getErrorCode(error) !== 'EEXIST' ||
        !(await hasMatchingFile(destination, identity, signal))
      ) {
        throw error;
      }
    }
  } catch (error) {
    if (signal?.aborted && error === signal.reason) {
      throw error;
    }
    throw getErrorCode(error) === ERRORS.FILE_TOO_LARGE ? contentMismatch() : error;
  } finally {
    await unlink(temporary);
  }
};
