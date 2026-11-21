import { Buffer } from 'node:buffer';
import type { BigIntStats } from 'node:fs';
import { lstat } from 'node:fs/promises';

import {
  BOUNDED_READ_CHUNK_SIZE,
  fileChanged,
  fileTooLarge,
  isMissingPathError,
  notAFile,
} from '../../shared/index.js';

import type { IHashFileOptions } from './types.js';
import { openWithoutFollowing } from './utilities.js';

const matchesFile = (current: BigIntStats, expected: BigIntStats): boolean =>
  current.isFile() &&
  current.dev === expected.dev &&
  current.ino === expected.ino &&
  current.size === expected.size &&
  current.mtimeNs === expected.mtimeNs &&
  current.ctimeNs === expected.ctimeNs;

/**
 * Compares the named path with the opened descriptor without resolving its final component.
 * @param path The named file.
 * @param expected The descriptor's initial state.
 * @returns A promise that resolves once the path is verified.
 * @throws
 * - FILE_CHANGED: The file '<path>' changed since it was read.
 */
const assertFileAtPath = async (path: string, expected: BigIntStats): Promise<void> => {
  let current: BigIntStats;
  try {
    current = await lstat(path, { bigint: true });
  } catch (error) {
    throw isMissingPathError(error) ? fileChanged(path) : error;
  }
  if (!matchesFile(current, expected)) {
    throw fileChanged(path);
  }
};

/**
 * Passes chunks from an open, stable file to an awaited consumer. The buffer is reused once the
 * consumer returns. One extra byte is read to detect growth after the initial size check.
 * @param path The file's path.
 * @param options A validated size limit and optional cancellation signal.
 * @param consume Processes one chunk before the buffer can be reused.
 * @returns A promise that resolves to the number of bytes consumed.
 * @throws
 * - NON_EXISTENT_FILE: The file '<path>' does not exist.
 * - NOT_A_FILE: The file '<path>' is a symbolic link.
 * - NOT_A_FILE: The path '<path>' is not a file.
 * - FILE_TOO_LARGE: The file '<path>' is larger than <maxBytes> bytes.
 * - FILE_CHANGED: The file '<path>' changed since it was read.
 */
export const readStableFile = async (
  path: string,
  { maxBytes = Number.MAX_SAFE_INTEGER, signal }: IHashFileOptions,
  consume: (chunk: Buffer) => void | Promise<void>,
): Promise<number> => {
  signal?.throwIfAborted();
  const handle = await openWithoutFollowing(path, true);
  try {
    const initial = await handle.stat({ bigint: true });
    if (!initial.isFile()) {
      throw notAFile(path);
    }
    await assertFileAtPath(path, initial);
    if (initial.size > BigInt(maxBytes)) {
      throw fileTooLarge(path, maxBytes);
    }

    const size = Number(initial.size);
    const buffer = Buffer.allocUnsafe(Math.min(BOUNDED_READ_CHUNK_SIZE, Math.max(1, size)));
    let position = 0;
    while (position < size) {
      signal?.throwIfAborted();
      const length = Math.min(buffer.byteLength, size - position);
      const { bytesRead } = await handle.read(buffer, 0, length, position);
      signal?.throwIfAborted();
      if (bytesRead === 0) {
        throw fileChanged(path);
      }
      await consume(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }

    signal?.throwIfAborted();
    const probe = await handle.read(buffer, 0, 1, size);
    signal?.throwIfAborted();
    if (probe.bytesRead > 0 || !matchesFile(await handle.stat({ bigint: true }), initial)) {
      throw fileChanged(path);
    }
    await assertFileAtPath(path, initial);
    signal?.throwIfAborted();
    return size;
  } finally {
    await handle.close();
  }
};
