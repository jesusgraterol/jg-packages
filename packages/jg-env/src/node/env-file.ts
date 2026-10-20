import type { Buffer } from 'node:buffer';
import { parseEnv } from 'node:util';

import { getErrorCode, Exception } from 'jg-exception';
import { ERRORS as FS_ERRORS, readBoundedFile, readPrivateFile } from 'jg-fs/sync';

import { ERRORS } from '../shared/index.js';
import type { IEnvSource, IReadEnvFileOptions } from './types.js';

// the largest .env file readEnvFile reads when the options don't say
const DEFAULT_MAX_ENV_FILE_BYTES = 65_536;

// the file system errors that mean a file isn't private, or isn't where it must be
const NOT_PRIVATE_CODES: ReadonlySet<string | null> = new Set([
  FS_ERRORS.FILE_NOT_PRIVATE,
  FS_ERRORS.PATH_NOT_CANONICAL,
  FS_ERRORS.PATH_OUTSIDE_ROOT,
  FS_ERRORS.NOT_A_DIRECTORY,
]);

/**
 * Checks whether a read failed because the file doesn't exist. Both reads report a missing file as
 * NON_EXISTENT_FILE, and the private read reports a missing `rootPath` as NON_EXISTENT_DIRECTORY.
 * @param error What the read threw.
 * @returns Whether the file is missing.
 */
const isMissingFileError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  return code === FS_ERRORS.NON_EXISTENT_FILE || code === FS_ERRORS.NON_EXISTENT_DIRECTORY;
};

/**
 * Turns a failed read into the package's error, which names the file and never its contents.
 * @param error What the read threw.
 * @param path The file's path.
 * @returns The error to throw.
 */
const toReadError = (error: unknown, path: string): Exception => {
  const fsCode = getErrorCode(error);
  if (fsCode === FS_ERRORS.FILE_TOO_LARGE) {
    return new Exception(`The environment file at ${path} is larger than allowed.`, {
      code: ERRORS.ENV_FILE_TOO_LARGE,
      data: { path },
      cause: error,
    });
  }
  if (NOT_PRIVATE_CODES.has(fsCode)) {
    return new Exception(
      `The environment file at ${path} isn't private, or isn't inside its root directory.`,
      { code: ERRORS.ENV_FILE_NOT_PRIVATE, data: { path }, cause: error },
    );
  }
  return new Exception(`The environment file at ${path} could not be read.`, {
    code: ERRORS.ENV_FILE_UNREADABLE,
    data: { path },
    cause: error,
  });
};

/**
 * Reads a .env file's variables into a record, without changing `process.env`. The file is read
 * with a size limit, as UTF-8, without a byte-order mark, and parsed by Node.js's own
 * `util.parseEnv`: quotes, multiline values in double quotes, `export`, and comments, with a later
 * key winning and no `${...}` expansion. A line it can't parse is skipped. With `requirePrivate`,
 * the file must be private, inside `rootPath` when one is given, and not reached through a symbolic
 * link, such as an overlay holding secrets. A missing file, or a missing `rootPath`, reads as `{}`
 * with `isOptional`. Errors name the file and never a value.
 * @param path The file's path.
 * @param options Whether it must be private, its size limit and root, and whether it may be missing.
 * @returns The variables.
 * @example
 * import { mergeEnvSources, readEnvFile } from 'jg-env/node';
 *
 * const variables = mergeEnvSources(
 *   readEnvFile('.env'),
 *   readEnvFile('.env.local', { requirePrivate: true, isOptional: true }),
 *   process.env,
 * );
 * @throws
 * - ENV_FILE_UNREADABLE: The environment file could not be read.
 * - ENV_FILE_NOT_PRIVATE: The environment file isn't private, or isn't inside its root directory.
 * - ENV_FILE_TOO_LARGE: The environment file is larger than allowed.
 * - ENV_FILE_INVALID: The environment file isn't valid UTF-8 text.
 */
export const readEnvFile = (
  path: string,
  {
    requirePrivate = false,
    maxBytes = DEFAULT_MAX_ENV_FILE_BYTES,
    rootPath,
    isOptional = false,
  }: IReadEnvFileOptions = {},
): Record<string, string> => {
  let bytes: Buffer;
  try {
    bytes = requirePrivate
      ? readPrivateFile(path, { maxBytes, rootPath })
      : readBoundedFile(path, maxBytes);
  } catch (error) {
    if (isOptional && isMissingFileError(error)) {
      return {};
    }
    throw toReadError(error, path);
  }
  let text: string;
  try {
    // fatal, so bytes that aren't UTF-8 throw; the byte-order mark is removed
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // the decoder's error isn't kept as the cause, so no byte of the file reaches a log
    throw new Exception(`The environment file at ${path} isn't valid UTF-8 text.`, {
      code: ERRORS.ENV_FILE_INVALID,
      data: { path },
    });
  }
  return Object.fromEntries(
    Object.entries(parseEnv(text)).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
};

/**
 * Merges the variables of several sources, such as a base .env file, a local overlay, and
 * `process.env`, into one record: a later source wins, and an undefined value is skipped, so it
 * never hides an earlier one. The sources aren't changed.
 * @param sources The sources, from the lowest priority to the highest.
 * @returns The merged variables.
 * @example
 * import { mergeEnvSources } from 'jg-env/node';
 *
 * mergeEnvSources({ PORT: '3000', HOST: 'localhost' }, { PORT: '4000', HOST: undefined });
 * // { PORT: '4000', HOST: 'localhost' }
 */
export const mergeEnvSources = (...sources: IEnvSource[]): Record<string, string> => {
  const merged: Record<string, string> = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined) {
        // defined rather than assigned, so a "__proto__" key stays a plain variable
        Object.defineProperty(merged, key, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
  }
  return merged;
};
