import { createHash } from 'node:crypto';

import { invalidArgument } from '../shared/index.js';
import type { ICalculateGitBlobObjectIdOptions } from './types.js';

/**
 * Calculates the object ID Git gives a file's content, as `git hash-object` does, without running
 * Git: the hash of `blob <length>\0` followed by the bytes.
 * @param content The file's bytes, or its text, encoded as UTF-8.
 * @param options The repository's object format.
 * @returns The object ID, in lowercase hexadecimal.
 * @example
 * import { calculateGitBlobObjectId } from 'jg-git-commands';
 *
 * calculateGitBlobObjectId('hello\n'); // 'ce013625030ba8dba906f756967f9e9ca394464a'
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 */
export const calculateGitBlobObjectId = (
  content: string | Uint8Array,
  { algorithm = 'sha1' }: ICalculateGitBlobObjectIdOptions = {},
): string => {
  if (typeof content !== 'string' && !(content instanceof Uint8Array)) {
    throw invalidArgument('content');
  }
  if (algorithm !== 'sha1' && algorithm !== 'sha256') {
    throw invalidArgument('algorithm');
  }
  const bytes = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  return createHash(algorithm).update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
};
