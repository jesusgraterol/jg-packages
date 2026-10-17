import type { Stats } from 'node:fs';
import { basename, extname, isAbsolute, relative, resolve, sep } from 'node:path';

import type { IPathElement } from './types.js';

/**
 * Checks whether a path is a root path or nested inside it. The check is lexical: both paths are
 * resolved without touching the filesystem, and symbolic links aren't followed. Sibling paths
 * that share a prefix, such as `/data/app` and `/data/application`, aren't nested, and neither is a
 * path on another drive on Windows.
 * @param rootPath The root path.
 * @param targetPath The path to check.
 * @returns Whether the target is the root or inside it.
 * @example
 * import { isPathWithin } from 'jg-fs';
 *
 * isPathWithin('/data/app', '/data/app/logs/today.log'); // true
 * isPathWithin('/data/app', '/data/app/../secrets'); // false
 * isPathWithin('/data/app', '/data/application'); // false
 */
export const isPathWithin = (rootPath: string, targetPath: string): boolean => {
  const relativePath = relative(resolve(rootPath), resolve(targetPath));
  return (
    relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
  );
};

/**
 * Describes a path from its lstat result.
 * @param path The path.
 * @param stats Its lstat result.
 * @returns The path element.
 */
export const toPathElement = (path: string, stats: Stats): IPathElement => ({
  path,
  baseName: basename(path),
  extName: extname(path),
  isFile: stats.isFile(),
  isDirectory: stats.isDirectory(),
  isSymbolicLink: stats.isSymbolicLink(),
  size: stats.size,
  creation: Math.round(stats.birthtimeMs),
});
