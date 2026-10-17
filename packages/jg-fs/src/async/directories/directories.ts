import { cp, mkdir, readdir, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Exception } from 'jg-exception';

import {
  buildDirectoryElementsOptions,
  DIRECTORY_ELEMENTS_CONCURRENCY,
  ERRORS,
  groupDirectoryElements,
  notADirectory,
  type IDirectoryElementsOptions,
  type IDirectoryPathElements,
  type IPathElement,
} from '../../shared/index.js';
import { getPathElement } from '../general/index.js';

import { mapWithConcurrency } from './utilities.js';

/**
 * Checks whether a path exists and is a directory.
 * @param path The path.
 * @returns A promise that resolves to whether the path is a directory.
 * @example
 * import { isDirectory } from 'jg-fs';
 *
 * await isDirectory('dist'); // true
 */
export const isDirectory = async (path: string): Promise<boolean> =>
  (await getPathElement(path))?.isDirectory ?? false;

/**
 * Deletes a directory and everything in it. A missing directory is not an error.
 * @param path The directory's path.
 * @returns A promise that resolves once the directory is gone.
 * @example
 * import { deleteDirectory } from 'jg-fs';
 *
 * await deleteDirectory('dist');
 */
export const deleteDirectory = (path: string): Promise<void> =>
  rm(path, { recursive: true, force: true });

/**
 * Creates a directory, with any missing parents. An existing directory is kept, or replaced with
 * an empty one when `deleteIfExists` is set.
 * @param path The directory's path.
 * @param deleteIfExists Whether to delete an existing directory and its contents first.
 * @returns A promise that resolves once the directory exists.
 * @example
 * import { createDirectory } from 'jg-fs';
 *
 * await createDirectory('dist/assets'); // creates missing parents too
 * await createDirectory('dist', true); // replaces it with an empty directory
 * @throws
 * - DIRECTORY_ALREADY_EXISTS: if something other than a directory exists at the path
 */
export const createDirectory = async (path: string, deleteIfExists?: boolean): Promise<void> => {
  const element = await getPathElement(path);
  if (element !== null && !element.isDirectory) {
    throw new Exception(`The path '${path}' already exists and is not a directory.`, {
      code: ERRORS.DIRECTORY_ALREADY_EXISTS,
    });
  }
  if (element !== null && deleteIfExists) {
    await deleteDirectory(path);
  }
  await mkdir(path, { recursive: true });
};

/**
 * Copies a directory and everything in it, replacing the destination completely.
 * @param srcPath The directory to copy.
 * @param destPath Where to copy it.
 * @returns A promise that resolves once the copy is complete.
 * @example
 * import { copyDirectory } from 'jg-fs';
 *
 * await copyDirectory('templates', 'dist/templates');
 * @throws
 * - NOT_A_DIRECTORY: if the srcPath is not a directory
 */
export const copyDirectory = async (srcPath: string, destPath: string): Promise<void> => {
  if (!(await isDirectory(srcPath))) {
    throw notADirectory(srcPath);
  }
  await deleteDirectory(destPath);
  await cp(srcPath, destPath, { recursive: true });
};

/**
 * Creates a symbolic link to a directory.
 * @param target The directory the link points to.
 * @param path Where to create the link.
 * @returns A promise that resolves once the link exists.
 * @example
 * import { createDirectorySymLink } from 'jg-fs';
 *
 * await createDirectorySymLink('releases/1.4.0', 'current');
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the target directory doesn't exist
 * - NOT_A_DIRECTORY: if the target directory is not considered a directory by the OS
 */
export const createDirectorySymLink = async (target: string, path: string): Promise<void> => {
  const element = await getPathElement(target);
  if (element === null) {
    throw new Exception(`The target directory '${target}' does not exist.`, {
      code: ERRORS.NON_EXISTENT_DIRECTORY,
    });
  }
  if (!element.isDirectory) {
    throw notADirectory(target);
  }
  await symlink(target, path, 'dir');
};

/**
 * Lists a directory's contents as paths joined to the directory's path.
 * @param path The directory's path.
 * @param recursive Whether to include the contents of subdirectories.
 * @returns A promise that resolves to the content paths.
 * @example
 * import { readDirectory } from 'jg-fs';
 *
 * await readDirectory('dist'); // ['dist/index.js', 'dist/assets']
 * await readDirectory('dist', true); // includes the contents of dist/assets
 * @throws
 * - NOT_A_DIRECTORY: if the path doesn't exist or is not a directory
 */
export const readDirectory = async (
  path: string,
  recursive: boolean = false,
): Promise<string[]> => {
  if (!(await isDirectory(path))) {
    throw notADirectory(path);
  }
  const contentPaths = await readdir(path, { encoding: 'utf-8', recursive });
  return contentPaths.map((contentPath) => join(path, contentPath));
};

/**
 * Lists a directory's elements grouped by kind: directories, files (filtered by extension), and
 * symbolic links, each group sorted. Entries removed while the directory is read are left out, and
 * at most 32 entries are read at once.
 * @param path The directory's path.
 * @param options The extensions to include and how to sort.
 * @returns A promise that resolves to the grouped elements.
 * @example
 * import { getDirectoryElements } from 'jg-fs';
 *
 * const { files } = await getDirectoryElements('content', { includeExts: ['.md'], sortByKey: 'creation', sortOrder: 'desc' });
 * @throws
 * - NOT_A_DIRECTORY: if the path doesn't exist or is not a directory
 */
export const getDirectoryElements = async (
  path: string,
  options?: Partial<IDirectoryElementsOptions>,
): Promise<IDirectoryPathElements> => {
  const contentPaths = await readDirectory(path);
  const elements = (
    await mapWithConcurrency(contentPaths, DIRECTORY_ELEMENTS_CONCURRENCY, getPathElement)
  ).filter((element): element is IPathElement => element !== null);
  return groupDirectoryElements(elements, buildDirectoryElementsOptions(options));
};
