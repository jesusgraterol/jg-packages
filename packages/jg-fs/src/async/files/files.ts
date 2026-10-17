import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { WriteFileOptions } from 'node:fs';
import {
  copyFile as copyFileNode,
  mkdir,
  open,
  readFile as readFileNode,
  rename,
  rm,
  symlink,
  unlink,
  writeFile as writeFileNode,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Exception } from 'jg-exception';

import {
  assertBufferData,
  assertTextData,
  BOUNDED_READ_CHUNK_SIZE,
  ERRORS,
  fileTooLarge,
  notAFile,
  parseJSONContent,
  serializeJSONData,
  type IReadBufferFileOptions,
  type IReadFileOptions,
  type IReadStringFileOptions,
} from '../../shared/index.js';
import { getPathElement } from '../general/index.js';

import { openWithoutFollowing, readPermissionBits, syncDirectory } from './utilities.js';

/**
 * Checks whether a path exists and is a regular file.
 * @param path The path.
 * @returns A promise that resolves to whether the path is a file.
 * @example
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
 * await writeTextFile('notes/today.md', '# Today');
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the data isn't a string
 */
export const writeTextFile = async (path: string, data: string): Promise<void> => {
  assertTextData(path, data);
  await writeFile(path, data, { encoding: 'utf-8' });
};

/**
 * Writes a JSON file. A string is written as given; anything else is stringified.
 * @param path The file's path.
 * @param data The value, or its JSON text.
 * @param space The indentation for stringified values.
 * @returns A promise that resolves once the file is written.
 * @example
 * await writeJSONFile('config.json', { port: 8080 });
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the JSON content cannot be stringified or is empty
 */
export const writeJSONFile = async <T = Record<string, unknown>>(
  path: string,
  data: T | string,
  space: number = 2,
): Promise<void> => {
  await writeFile(path, serializeJSONData(path, data, space), { encoding: 'utf-8' });
};

/**
 * Writes a binary file. An empty Buffer writes an empty file.
 * @param path The file's path.
 * @param data The content.
 * @returns A promise that resolves once the file is written.
 * @example
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
 * await readFile('notes.md', 'utf-8'); // a string
 * await readFile('avatar.png'); // a Buffer
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or is not a file
 */
export async function readFile(path: string, options: IReadStringFileOptions): Promise<string>;
export async function readFile(path: string, options?: IReadBufferFileOptions): Promise<Buffer>;
export async function readFile(path: string, options?: IReadFileOptions): Promise<string | Buffer>;
export async function readFile(
  path: string,
  options: IReadFileOptions = null,
): Promise<string | Buffer> {
  if (!(await isFile(path))) {
    throw notAFile(path);
  }
  return readFileNode(path, options);
}

/**
 * Reads a UTF-8 text file. An empty file reads as an empty string.
 * @param path The file's path.
 * @returns A promise that resolves to the text.
 * @example
 * const markdown = await readTextFile('README.md');
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or is not a file
 */
export const readTextFile = (path: string): Promise<string> =>
  readFile(path, { encoding: 'utf-8' });

/**
 * Reads and parses a JSON file.
 * @param path The file's path.
 * @returns A promise that resolves to the parsed value.
 * @example
 * const config = await readJSONFile<{ port: number }>('config.json');
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or is not a file
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the file's JSON content cannot be parsed
 */
export const readJSONFile = async <T = Record<string, unknown>>(path: string): Promise<T> =>
  parseJSONContent<T>(path, await readTextFile(path));

/**
 * Reads a binary file. An empty file reads as an empty Buffer.
 * @param path The file's path.
 * @returns A promise that resolves to the content.
 * @example
 * const image = await readBufferFile('avatar.png');
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or is not a file
 */
export const readBufferFile = (path: string): Promise<Buffer> => readFile(path, null);

/**
 * Copies a file, replacing the destination when it exists.
 * @param srcPath The file to copy.
 * @param destPath Where to copy it.
 * @returns A promise that resolves once the copy exists.
 * @example
 * await copyFile('config.example.json', 'config.json');
 * @throws
 * - NOT_A_FILE: if the srcPath doesn't exist or is not a file
 */
export const copyFile = async (srcPath: string, destPath: string): Promise<void> => {
  if (!(await isFile(srcPath))) {
    throw notAFile(srcPath);
  }
  await copyFileNode(srcPath, destPath);
};

/**
 * Deletes a file.
 * @param path The file's path.
 * @returns A promise that resolves once the file is gone.
 * @example
 * await deleteFile('cache.json');
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or is not a file
 */
export const deleteFile = async (path: string): Promise<void> => {
  if (!(await isFile(path))) {
    throw notAFile(path);
  }
  await unlink(path);
};

/**
 * Creates a symbolic link to a file.
 * @param target The file the link points to.
 * @param path Where to create the link.
 * @returns A promise that resolves once the link exists.
 * @example
 * await createFileSymLink('config.production.json', 'config.json');
 * @throws
 * - NON_EXISTENT_FILE: if the target file does not exist
 * - NOT_A_FILE: if the target is not a file
 */
export const createFileSymLink = async (target: string, path: string): Promise<void> => {
  const element = await getPathElement(target);
  if (element === null) {
    throw new Exception(`The target file '${target}' does not exist.`, {
      code: ERRORS.NON_EXISTENT_FILE,
    });
  }
  if (!element.isFile) {
    throw notAFile(target);
  }
  await symlink(target, path, 'file');
};

/**
 * Writes a file atomically: readers see either the previous content or the complete new content,
 * never a partial write. The data goes to a temporary file in the same directory, which is flushed
 * to disk and renamed over the path; on POSIX, the directory is flushed too. An explicit mode wins;
 * without one, a replaced file keeps its permission bits and a new file gets the platform default.
 * The temporary file is never more widely readable than the final mode. When writing fails before
 * the rename, the temporary file is removed and the destination is untouched.
 * @param path The file's path.
 * @param data The content.
 * @param mode The permission bits of the written file, such as `0o600`.
 * @returns A promise that resolves once the file is written and flushed.
 * @example
 * await writeFileAtomic('state.json', JSON.stringify(state)); // readers never see a partial file
 * await writeFileAtomic('secrets.env', contents, 0o600);
 */
export const writeFileAtomic = async (
  path: string,
  data: string | NodeJS.ArrayBufferView,
  mode?: number,
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
    await rename(tempPath, path);
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
 * Reads a regular file of at most `maxBytes` bytes. It never follows a symbolic link in the
 * path's last component, though links in parent directories are followed, so callers that need
 * containment combine it with `isPathWithin`. It reads at most `maxBytes + 1` bytes, even when the
 * file grows while it's read.
 * @param path The file's path.
 * @param maxBytes The largest size accepted, in bytes.
 * @returns A promise that resolves to the content.
 * @example
 * const upload = await readBoundedFile(join(uploadsDirectory, name), 5 * 1024 * 1024); // at most 5 MB
 * @throws
 * - NOT_A_FILE: if the path doesn't exist, its final component is a symbolic link, or it isn't a regular file
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
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    while (totalBytes <= maxBytes) {
      const chunk = Buffer.allocUnsafe(
        Math.min(BOUNDED_READ_CHUNK_SIZE, maxBytes + 1 - totalBytes),
      );
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, totalBytes);
      if (bytesRead === 0) {
        break;
      }
      chunks.push(chunk.subarray(0, bytesRead));
      totalBytes += bytesRead;
    }
    if (totalBytes > maxBytes) {
      throw fileTooLarge(path, maxBytes);
    }
    return Buffer.concat(chunks, totalBytes);
  } finally {
    await handle.close();
  }
};
