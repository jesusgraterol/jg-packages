import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  fchmodSync,
  fstatSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  type WriteFileOptions,
} from 'node:fs';
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
 * @returns Whether the path is a file.
 * @example
 * isFile('package.json'); // true
 */
export const isFile = (path: string): boolean => getPathElement(path)?.isFile ?? false;

/**
 * Writes a file, creating its directory first when it doesn't exist.
 * @param path The file's path.
 * @param data The content.
 * @param options Node.js's writeFile options, such as the encoding or mode.
 * @example
 * writeFile('out/report.csv', csv, { encoding: 'utf-8' });
 */
export const writeFile = (
  path: string,
  data: string | NodeJS.ArrayBufferView,
  options?: WriteFileOptions,
): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data, options);
};

/**
 * Writes a UTF-8 text file. An empty string writes an empty file.
 * @param path The file's path.
 * @param data The text.
 * @example
 * writeTextFile('notes/today.md', '# Today');
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the data isn't a string
 */
export const writeTextFile = (path: string, data: string): void => {
  assertTextData(path, data);
  writeFile(path, data, { encoding: 'utf-8' });
};

/**
 * Writes a JSON file. A string is written as given; anything else is stringified.
 * @param path The file's path.
 * @param data The value, or its JSON text.
 * @param space The indentation for stringified values.
 * @example
 * writeJSONFile('config.json', { port: 8080 });
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the JSON content cannot be stringified or is empty
 */
export const writeJSONFile = <T = Record<string, unknown>>(
  path: string,
  data: T | string,
  space: number = 2,
): void => {
  writeFile(path, serializeJSONData(path, data, space), { encoding: 'utf-8' });
};

/**
 * Writes a binary file. An empty Buffer writes an empty file.
 * @param path The file's path.
 * @param data The content.
 * @example
 * writeBufferFile('avatar.png', imageBuffer);
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the data isn't a Buffer
 */
export const writeBufferFile = (path: string, data: Buffer): void => {
  assertBufferData(path, data);
  writeFile(path, data);
};

/**
 * Reads a file as a string when an encoding is given, or as a Buffer otherwise.
 * @param path The file's path.
 * @param options Node.js's readFile options, such as the encoding.
 * @returns The content.
 * @example
 * readFile('notes.md', 'utf-8'); // a string
 * readFile('avatar.png'); // a Buffer
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or is not a file
 */
export function readFile(path: string, options: IReadStringFileOptions): string;
export function readFile(path: string, options?: IReadBufferFileOptions): Buffer;
export function readFile(path: string, options?: IReadFileOptions): string | Buffer;
export function readFile(path: string, options: IReadFileOptions = null): string | Buffer {
  if (!isFile(path)) {
    throw notAFile(path);
  }
  return readFileSync(path, options as Parameters<typeof readFileSync>[1]);
}

/**
 * Reads a UTF-8 text file. An empty file reads as an empty string.
 * @param path The file's path.
 * @returns The text.
 * @example
 * const markdown = readTextFile('README.md');
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or is not a file
 */
export const readTextFile = (path: string): string => readFile(path, { encoding: 'utf-8' });

/**
 * Reads and parses a JSON file.
 * @param path The file's path.
 * @returns The parsed value.
 * @example
 * const config = readJSONFile<{ port: number }>('config.json');
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or is not a file
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the file's JSON content cannot be parsed
 */
export const readJSONFile = <T = Record<string, unknown>>(path: string): T =>
  parseJSONContent<T>(path, readTextFile(path));

/**
 * Reads a binary file. An empty file reads as an empty Buffer.
 * @param path The file's path.
 * @returns The content.
 * @example
 * const image = readBufferFile('avatar.png');
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or is not a file
 */
export const readBufferFile = (path: string): Buffer => readFile(path, null);

/**
 * Copies a file, replacing the destination when it exists.
 * @param srcPath The file to copy.
 * @param destPath Where to copy it.
 * @example
 * copyFile('config.example.json', 'config.json');
 * @throws
 * - NOT_A_FILE: if the srcPath doesn't exist or is not a file
 */
export const copyFile = (srcPath: string, destPath: string): void => {
  if (!isFile(srcPath)) {
    throw notAFile(srcPath);
  }
  copyFileSync(srcPath, destPath);
};

/**
 * Deletes a file.
 * @param path The file's path.
 * @example
 * deleteFile('cache.json');
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or is not a file
 */
export const deleteFile = (path: string): void => {
  if (!isFile(path)) {
    throw notAFile(path);
  }
  unlinkSync(path);
};

/**
 * Creates a symbolic link to a file.
 * @param target The file the link points to.
 * @param path Where to create the link.
 * @example
 * createFileSymLink('config.production.json', 'config.json');
 * @throws
 * - NON_EXISTENT_FILE: if the target file does not exist
 * - NOT_A_FILE: if the target is not a file
 */
export const createFileSymLink = (target: string, path: string): void => {
  const element = getPathElement(target);
  if (element === null) {
    throw new Exception(`The target file '${target}' does not exist.`, {
      code: ERRORS.NON_EXISTENT_FILE,
    });
  }
  if (!element.isFile) {
    throw notAFile(target);
  }
  symlinkSync(target, path, 'file');
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
 * @example
 * writeFileAtomic('state.json', JSON.stringify(state)); // readers never see a partial file
 * writeFileAtomic('secrets.env', contents, 0o600);
 */
export const writeFileAtomic = (
  path: string,
  data: string | NodeJS.ArrayBufferView,
  mode?: number,
): void => {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true });
  const finalMode = mode ?? readPermissionBits(path);
  const tempPath = join(directory, `.${randomUUID()}.tmp`);
  let isRenamed = false;
  try {
    // a known final mode is applied with chmod, so the umask can't change it
    const descriptor = openSync(tempPath, 'wx', finalMode === undefined ? 0o666 : 0o600);
    try {
      if (finalMode !== undefined) {
        fchmodSync(descriptor, finalMode);
      }
      writeFileSync(descriptor, data);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(tempPath, path);
    isRenamed = true;
  } finally {
    if (!isRenamed) {
      rmSync(tempPath, { force: true });
    }
  }
  if (process.platform !== 'win32') {
    syncDirectory(directory);
  }
};

/**
 * Reads a regular file of at most `maxBytes` bytes. It never follows a symbolic link in the
 * path's last component, though links in parent directories are followed, so callers that need
 * containment combine it with `isPathWithin`. It reads at most `maxBytes + 1` bytes, even when the
 * file grows while it's read.
 * @param path The file's path.
 * @param maxBytes The largest size accepted, in bytes.
 * @returns The content.
 * @example
 * const upload = readBoundedFile(join(uploadsDirectory, name), 5 * 1024 * 1024); // at most 5 MB
 * @throws
 * - NOT_A_FILE: if the path doesn't exist, its final component is a symbolic link, or it isn't a regular file
 * - FILE_TOO_LARGE: if the file holds more than maxBytes bytes
 */
export const readBoundedFile = (path: string, maxBytes: number): Buffer => {
  const descriptor = openWithoutFollowing(path);
  try {
    const stats = fstatSync(descriptor);
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
      const bytesRead = readSync(descriptor, chunk, 0, chunk.length, totalBytes);
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
    closeSync(descriptor);
  }
};
