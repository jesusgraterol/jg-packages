import type { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { WriteFileOptions } from 'node:fs';
import {
  copyFile as copyFileNode,
  mkdir,
  open,
  readFile as readFileNode,
  rm,
  symlink,
  unlink,
  writeFile as writeFileNode,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getErrorCode } from 'jg-exception';

import {
  assertBufferData,
  assertTextData,
  fileChanged,
  fileTooLarge,
  nonExistentFile,
  notAFile,
  ERRORS,
  parseJsonContent,
  serializeJsonData,
  type IReadBufferFileOptions,
  type IReadFileOptions,
  type IReadJsonFileOptions,
  type IReadStringFileOptions,
} from '../../shared/index.js';
import { getPathElement } from '../general/index.js';

import {
  assertExistingFile,
  openWithoutFollowing,
  readOpenFile,
  readPermissionBits,
  renameReplacing,
  resolveWriteTarget,
  syncDirectory,
} from './utilities.js';

/**
 * Checks whether a path exists and is a regular file.
 * @param path The path.
 * @returns A promise that resolves to whether the path is a file.
 * @example
 * import { isFile } from 'jg-fs';
 *
 * await isFile('package.json'); // true
 */
export const isFile = async (path: string): Promise<boolean> =>
  (await getPathElement(path))?.isFile ?? false;

/**
 * Writes a file, creating its directory first when it doesn't exist.
 * @param path The file's path.
 * @param data The content.
 * @param options Node.js's writeFile options, such as the encoding or mode.
 * @returns A promise that resolves once the file is written.
 * @example
 * import { writeFile } from 'jg-fs';
 *
 * const csv = 'id,name\n1,Ada\n';
 * await writeFile('out/report.csv', csv, { encoding: 'utf-8' });
 */
export const writeFile = async (
  path: string,
  data: string | NodeJS.ArrayBufferView,
  options?: WriteFileOptions,
): Promise<void> => {
  // a recursive mkdir succeeds when a concurrent call already created the directory
  await mkdir(dirname(path), { recursive: true });
  await writeFileNode(path, data, options);
};

/**
 * Writes a UTF-8 text file. An empty string writes an empty file.
 * @param path The file's path.
 * @param data The text.
 * @returns A promise that resolves once the file is written.
 * @example
 * import { writeTextFile } from 'jg-fs';
 *
 * await writeTextFile('notes/today.md', '# Today');
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the data isn't a string
 */
export const writeTextFile = async (path: string, data: string): Promise<void> => {
  assertTextData(path, data);
  await writeFile(path, data, { encoding: 'utf-8' });
};

/**
 * Writes a JSON file atomically, as writeFileAtomic does, so a crash or a full disk never leaves a
 * truncated file that won't parse. A symbolic link at the path keeps pointing at the file, whose
 * target is replaced. A string is written as given; anything else is stringified.
 * @param path The file's path.
 * @param data The value, or its JSON text.
 * @param space The indentation for stringified values.
 * @returns A promise that resolves once the file is written.
 * @example
 * import { writeJsonFile } from 'jg-fs';
 *
 * await writeJsonFile('config.json', { port: 8080 });
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the JSON content cannot be stringified or is empty
 */
export const writeJsonFile = async <T = Record<string, unknown>>(
  path: string,
  data: T | string,
  space: number = 2,
): Promise<void> => {
  const content = serializeJsonData(path, data, space);
  await writeFileAtomic(await resolveWriteTarget(path), content);
};

/**
 * Writes a binary file. An empty Buffer writes an empty file.
 * @param path The file's path.
 * @param data The content.
 * @returns A promise that resolves once the file is written.
 * @example
 * import { writeBufferFile } from 'jg-fs';
 *
 * const imageBuffer = Buffer.from('iVBORw0KGgo=', 'base64');
 * await writeBufferFile('avatar.png', imageBuffer);
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the data isn't a Buffer
 */
export const writeBufferFile = async (path: string, data: Buffer): Promise<void> => {
  assertBufferData(path, data);
  await writeFile(path, data);
};

/**
 * Reads a file as a string when an encoding is given, or as a Buffer otherwise.
 * @param path The file's path.
 * @param options Node.js's readFile options, such as the encoding.
 * @returns A promise that resolves to the content.
 * @example
 * import { readFile } from 'jg-fs';
 *
 * await readFile('notes.md', 'utf-8'); // a string
 * await readFile('avatar.png'); // a Buffer
 * @throws
 * - NON_EXISTENT_FILE: if the path doesn't exist
 * - NOT_A_FILE: if the path is not a file
 */
export async function readFile(path: string, options: IReadStringFileOptions): Promise<string>;
export async function readFile(path: string, options?: IReadBufferFileOptions): Promise<Buffer>;
export async function readFile(path: string, options?: IReadFileOptions): Promise<string | Buffer>;
export async function readFile(
  path: string,
  options: IReadFileOptions = null,
): Promise<string | Buffer> {
  await assertExistingFile(path);
  return readFileNode(path, options);
}

/**
 * Reads a UTF-8 text file. An empty file reads as an empty string.
 * @param path The file's path.
 * @returns A promise that resolves to the text.
 * @example
 * import { readTextFile } from 'jg-fs';
 *
 * const markdown = await readTextFile('README.md');
 * @throws
 * - NON_EXISTENT_FILE: if the path doesn't exist
 * - NOT_A_FILE: if the path is not a file
 */
export const readTextFile = (path: string): Promise<string> =>
  readFile(path, { encoding: 'utf-8' });

/**
 * Reads and parses a JSON file, and validates it with the schema when there is one. Without a
 * schema, the value is `unknown`, or the type you pass. With `maxBytes`, it reads the file as
 * readBoundedFile does, for a file whose size isn't yours to decide.
 * @param path The file's path.
 * @param options The schema, such as a Zod schema, whose errors propagate unchanged, and the
 * largest file accepted, in bytes.
 * @returns A promise that resolves to the parsed value.
 * @example
 * import { readJsonFile } from 'jg-fs';
 *
 * const config = await readJsonFile('config.json', { schema: Config }); // Config's type
 * @example
 * import { readJsonFile } from 'jg-fs';
 *
 * const value = await readJsonFile('data.json'); // unknown
 * @throws
 * - NON_EXISTENT_FILE: if the path doesn't exist
 * - NOT_A_FILE: if the path is not a file
 * - FILE_TOO_LARGE: if the file holds more than maxBytes bytes
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the file's JSON content cannot be parsed
 */
export const readJsonFile = async <T = unknown>(
  path: string,
  options: IReadJsonFileOptions<T> = {},
): Promise<T> =>
  parseJsonContent(
    path,
    options.maxBytes === undefined
      ? await readTextFile(path)
      : (await readBoundedFile(path, options.maxBytes)).toString('utf-8'),
    options.schema,
  );

/**
 * Reads a binary file. An empty file reads as an empty Buffer.
 * @param path The file's path.
 * @returns A promise that resolves to the content.
 * @example
 * import { readBufferFile } from 'jg-fs';
 *
 * const image = await readBufferFile('avatar.png');
 * @throws
 * - NON_EXISTENT_FILE: if the path doesn't exist
 * - NOT_A_FILE: if the path is not a file
 */
export const readBufferFile = (path: string): Promise<Buffer> => readFile(path, null);

/**
 * Copies a file, replacing the destination when it exists.
 * @param srcPath The file to copy.
 * @param destPath Where to copy it.
 * @returns A promise that resolves once the copy exists.
 * @example
 * import { copyFile } from 'jg-fs';
 *
 * await copyFile('config.example.json', 'config.json');
 * @throws
 * - NON_EXISTENT_FILE: if the srcPath doesn't exist
 * - NOT_A_FILE: if the srcPath is not a file
 */
export const copyFile = async (srcPath: string, destPath: string): Promise<void> => {
  await assertExistingFile(srcPath);
  await copyFileNode(srcPath, destPath);
};

/**
 * Deletes a file.
 * @param path The file's path.
 * @returns A promise that resolves once the file is gone.
 * @example
 * import { deleteFile } from 'jg-fs';
 *
 * await deleteFile('cache.json');
 * @throws
 * - NON_EXISTENT_FILE: if the path doesn't exist
 * - NOT_A_FILE: if the path is not a file
 */
export const deleteFile = async (path: string): Promise<void> => {
  await assertExistingFile(path);
  await unlink(path);
};

/**
 * Creates a symbolic link to a file.
 * @param target The file the link points to.
 * @param path Where to create the link.
 * @returns A promise that resolves once the link exists.
 * @example
 * import { createFileSymLink } from 'jg-fs';
 *
 * await createFileSymLink('config.production.json', 'config.json');
 * @throws
 * - NON_EXISTENT_FILE: if the target file does not exist
 * - NOT_A_FILE: if the target is not a file
 */
export const createFileSymLink = async (target: string, path: string): Promise<void> => {
  const element = await getPathElement(target);
  if (element === null) {
    throw nonExistentFile(target);
  }
  if (!element.isFile) {
    throw notAFile(target);
  }
  await symlink(target, path, 'file');
};

/**
 * Writes a file through a temporary file renamed over it, as writeFileAtomic describes, running a
 * check right before the rename.
 * @param path The file's path.
 * @param data The content.
 * @param mode The permission bits, or undefined to keep the file's own.
 * @param beforeRename A check that throws to leave the file as it is.
 * @returns A promise that resolves once the file is written and flushed.
 */
const writeAtomically = async (
  path: string,
  data: string | NodeJS.ArrayBufferView,
  mode: number | undefined,
  beforeRename?: () => Promise<void>,
): Promise<void> => {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true });
  const finalMode = mode ?? (await readPermissionBits(path));
  const tempPath = join(directory, `.${randomUUID()}.tmp`);
  let isRenamed = false;
  try {
    // a known final mode is applied with chmod, so the umask can't change it
    const handle = await open(tempPath, 'wx', finalMode === undefined ? 0o666 : 0o600);
    try {
      if (finalMode !== undefined) {
        await handle.chmod(finalMode);
      }
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await beforeRename?.();
    await renameReplacing(tempPath, path);
    isRenamed = true;
  } finally {
    if (!isRenamed) {
      await rm(tempPath, { force: true });
    }
  }
  if (process.platform !== 'win32') {
    await syncDirectory(directory);
  }
};

/**
 * Writes a file atomically: readers see either the previous content or the complete new content,
 * never a partial write. The data goes to a temporary file in the same directory, which is flushed
 * to disk and renamed over the path; on POSIX, the directory is flushed too. An explicit mode wins;
 * without one, a replaced file keeps its permission bits and a new file gets the platform default.
 * The temporary file is never more widely readable than the final mode. When writing fails before
 * the rename, the temporary file is removed and the destination is untouched. While Windows refuses
 * the rename because another process, such as an antivirus scanner, holds the file, it tries again
 * for about 4 seconds. A symbolic link at the path is replaced by the file.
 * @param path The file's path.
 * @param data The content.
 * @param mode The permission bits of the written file, such as `0o600`.
 * @returns A promise that resolves once the file is written and flushed.
 * @example
 * import { writeFileAtomic } from 'jg-fs';
 *
 * const state = { step: 2 };
 * await writeFileAtomic('state.json', JSON.stringify(state)); // readers never see a partial file
 * await writeFileAtomic('secrets.env', 'TOKEN=abc\n', 0o600); // only the owner can read it
 */
export const writeFileAtomic = (
  path: string,
  data: string | NodeJS.ArrayBufferView,
  mode?: number,
): Promise<void> => writeAtomically(path, data, mode);

/**
 * Writes a file atomically, as writeFileAtomic does, only when it still holds what the caller read,
 * such as a config file another program may have edited since: just before the rename, it reads
 * the file again, without following a link, and compares its bytes with `expected`. It throws
 * `FILE_CHANGED`, leaving the file as it is, when they differ, when the path is now a symbolic link
 * or not a regular file, or when `expected` is null, for a file that didn't exist, and something now
 * exists at the path. A change made between that read and the rename itself, a short window, isn't
 * detected. A replaced file keeps its permission bits.
 * @param path The file's path.
 * @param data The new content.
 * @param expected The bytes the file held when the caller read it, or null when it didn't exist.
 * @returns A promise that resolves once the file is written and flushed.
 * @example
 * import { readBoundedFile, writeFileAtomicIfUnchanged } from 'jg-fs';
 *
 * const before = await readBoundedFile('.npmrc', 65_536);
 * await writeFileAtomicIfUnchanged('.npmrc', `${before.toString('utf8')}save-exact=true\n`, before);
 * @throws
 * - FILE_CHANGED: The file '<path>' changed since it was read.
 */
export const writeFileAtomicIfUnchanged = (
  path: string,
  data: string | NodeJS.ArrayBufferView,
  expected: Uint8Array | null,
): Promise<void> =>
  writeAtomically(path, data, undefined, async () => {
    let current: Buffer | null;
    try {
      // one byte past what's expected is enough to tell the file grew
      current = await readBoundedFile(path, expected === null ? 0 : expected.byteLength);
    } catch (error) {
      if (getErrorCode(error) === ERRORS.NON_EXISTENT_FILE) {
        current = null;
      } else if (
        getErrorCode(error) === ERRORS.NOT_A_FILE ||
        getErrorCode(error) === ERRORS.FILE_TOO_LARGE
      ) {
        throw fileChanged(path);
      } else {
        throw error;
      }
    }
    const isUnchanged =
      expected === null ? current === null : current !== null && current.equals(expected);
    if (!isUnchanged) {
      throw fileChanged(path);
    }
  });

/**
 * Reads a regular file of at most `maxBytes` bytes. It never follows a symbolic link in the
 * path's last component, though links in parent directories are followed, so callers that need
 * containment combine it with `isPathWithin`. It reads at most `maxBytes + 1` bytes, even when the
 * file grows while it's read.
 * @param path The file's path.
 * @param maxBytes The largest size accepted, in bytes.
 * @returns A promise that resolves to the content.
 * @example
 * import { join } from 'node:path';
 * import { readBoundedFile } from 'jg-fs';
 *
 * const upload = await readBoundedFile(join('uploads', 'avatar.png'), 5 * 1024 * 1024); // at most 5 MB
 * @throws
 * - NON_EXISTENT_FILE: if the path doesn't exist
 * - NOT_A_FILE: if its final component is a symbolic link, or it isn't a regular file
 * - FILE_TOO_LARGE: if the file holds more than maxBytes bytes
 */
export const readBoundedFile = async (path: string, maxBytes: number): Promise<Buffer> => {
  const handle = await openWithoutFollowing(path);
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw notAFile(path);
    }
    if (stats.size > maxBytes) {
      throw fileTooLarge(path, maxBytes);
    }
    return await readOpenFile(handle, path, maxBytes);
  } finally {
    await handle.close();
  }
};
