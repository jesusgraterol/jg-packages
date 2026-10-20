import { cpSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Exception } from 'jg-exception';

import {
  buildDirectoryElementsOptions,
  ERRORS,
  groupDirectoryElements,
  nonExistentDirectory,
  notADirectory,
  type IDirectoryElementsOptions,
  type IDirectoryPathElements,
  type IPathElement,
} from '../../shared/index.js';
import { getPathElement } from '../general/index.js';

import { assertExistingDirectory } from './utilities.js';

/**
 * Checks whether a path exists and is a directory.
 * @param path The path.
 * @returns Whether the path is a directory.
 * @example
 * import { isDirectory } from 'jg-fs/sync';
 *
 * isDirectory('dist'); // true
 */
export const isDirectory = (path: string): boolean => getPathElement(path)?.isDirectory ?? false;

/**
 * Deletes a directory and everything in it. A missing directory is not an error.
 * @param path The directory's path.
 * @example
 * import { deleteDirectory } from 'jg-fs/sync';
 *
 * deleteDirectory('dist');
 */
export const deleteDirectory = (path: string): void =>
  rmSync(path, { recursive: true, force: true });

/**
 * Creates a directory, with any missing parents. An existing directory is kept, or replaced with
 * an empty one when `deleteIfExists` is set.
 * @param path The directory's path.
 * @param deleteIfExists Whether to delete an existing directory and its contents first.
 * @example
 * import { createDirectory } from 'jg-fs/sync';
 *
 * createDirectory('dist/assets'); // creates missing parents too
 * createDirectory('dist', true); // replaces it with an empty directory
 * @throws
 * - DIRECTORY_ALREADY_EXISTS: if something other than a directory exists at the path
 */
export const createDirectory = (path: string, deleteIfExists?: boolean): void => {
  const element = getPathElement(path);
  if (element !== null && !element.isDirectory) {
    throw new Exception(`The path '${path}' already exists and is not a directory.`, {
      code: ERRORS.DIRECTORY_ALREADY_EXISTS,
    });
  }
  if (element !== null && deleteIfExists) {
    deleteDirectory(path);
  }
  mkdirSync(path, { recursive: true });
};

/**
 * Copies a directory and everything in it, replacing the destination completely.
 * @param srcPath The directory to copy.
 * @param destPath Where to copy it.
 * @example
 * import { copyDirectory } from 'jg-fs/sync';
 *
 * copyDirectory('templates', 'dist/templates');
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the srcPath doesn't exist
 * - NOT_A_DIRECTORY: if the srcPath is not a directory
 */
export const copyDirectory = (srcPath: string, destPath: string): void => {
  assertExistingDirectory(srcPath);
  deleteDirectory(destPath);
  cpSync(srcPath, destPath, { recursive: true });
};

/**
 * Creates a symbolic link to a directory.
 * @param target The directory the link points to.
 * @param path Where to create the link.
 * @example
 * import { createDirectorySymLink } from 'jg-fs/sync';
 *
 * createDirectorySymLink('releases/1.4.0', 'current');
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the target directory doesn't exist
 * - NOT_A_DIRECTORY: if the target directory is not considered a directory by the OS
 */
export const createDirectorySymLink = (target: string, path: string): void => {
  const element = getPathElement(target);
  if (element === null) {
    throw nonExistentDirectory(target);
  }
  if (!element.isDirectory) {
    throw notADirectory(target);
  }
  symlinkSync(target, path, 'dir');
};

/**
 * Lists a directory's contents as paths joined to the directory's path.
 * @param path The directory's path.
 * @param recursive Whether to include the contents of subdirectories.
 * @returns The content paths.
 * @example
 * import { readDirectory } from 'jg-fs/sync';
 *
 * readDirectory('dist'); // ['dist/index.js', 'dist/assets']
 * readDirectory('dist', true); // includes the contents of dist/assets
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the path doesn't exist
 * - NOT_A_DIRECTORY: if the path is not a directory
 */
export const readDirectory = (path: string, recursive: boolean = false): string[] => {
  assertExistingDirectory(path);
  return readdirSync(path, { encoding: 'utf-8', recursive }).map((contentPath) =>
    join(path, contentPath),
  );
};

/**
 * Lists a directory's elements grouped by kind: directories, files (filtered by extension), and
 * symbolic links, each group sorted. Entries removed while the directory is read are left out.
 * @param path The directory's path.
 * @param options The extensions to include and how to sort.
 * @returns The grouped elements.
 * @example
 * import { getDirectoryElements } from 'jg-fs/sync';
 *
 * const { files } = getDirectoryElements('content', { includeExts: ['.md'], sortByKey: 'creation', sortOrder: 'desc' });
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the path doesn't exist
 * - NOT_A_DIRECTORY: if the path is not a directory
 */
export const getDirectoryElements = (
  path: string,
  options?: Partial<IDirectoryElementsOptions>,
): IDirectoryPathElements => {
  const elements = readDirectory(path)
    .map(getPathElement)
    .filter((element): element is IPathElement => element !== null);
  return groupDirectoryElements(elements, buildDirectoryElementsOptions(options));
};
