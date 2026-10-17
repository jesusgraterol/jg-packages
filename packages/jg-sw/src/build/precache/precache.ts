import { basename, join, relative, sep } from 'node:path';
import { Exception } from 'jg-exception';
import { getPathElement, isPathWithin, readDirectory, type IPathElement } from 'jg-fs';

import { ERRORS } from '../shared/index.js';

/**
 * Turns a file inside outDir into the URL path the app requests it at. Characters that would end
 * the path, such as `#` and `?`, are percent-encoded.
 * @param outDir The build's directory.
 * @param path The file's path.
 * @returns The URL path, such as `/assets/index-B3okp6nu.js`.
 */
const toUrlPath = (outDir: string, path: string): string =>
  `/${relative(outDir, path)
    .split(sep)
    .map((segment) => segment.replace(/[%#?]/g, encodeURIComponent))
    .join('/')}`;

/**
 * Lists the regular files inside a directory and its subdirectories, sorted, leaving out
 * symbolic links.
 * @param directory The directory.
 * @returns A promise that resolves to the files' paths.
 */
const listFiles = async (directory: string): Promise<string[]> => {
  const paths = await readDirectory(directory, true);
  const elements = await Promise.all(paths.map((path) => getPathElement(path)));
  return elements
    .filter((element): element is IPathElement => element?.isFile === true)
    .map(({ path }) => path)
    .sort();
};

/**
 * Lists the URL paths the worker precaches, in order and without duplicates: each included file,
 * and every file inside each included directory, except those whose names are excluded. `/`
 * stands for the app's root page and is kept as it is.
 * @param outDir The build's directory, which included paths are relative to.
 * @param includeToPrecache The files and directories to precache.
 * @param excludeFilesFromPrecache The file names to leave out.
 * @returns A promise that resolves to the URL paths.
 * @throws
 * - NOT_A_PATH_ELEMENT: The asset is outside outDir, or isn't a file or a directory.
 */
export const buildPrecacheAssetPaths = async (
  outDir: string,
  includeToPrecache: string[],
  excludeFilesFromPrecache: string[],
): Promise<string[]> => {
  const excludedNames = new Set(excludeFilesFromPrecache);
  const assets = new Set<string>();
  for (const includedPath of includeToPrecache) {
    if (includedPath === '/') {
      assets.add('/');
      continue;
    }
    const path = join(outDir, includedPath);
    if (!isPathWithin(outDir, path)) {
      throw new Exception(`The asset '${includedPath}' is outside the outDir '${outDir}'.`, {
        code: ERRORS.NOT_A_PATH_ELEMENT,
      });
    }
    const element = await getPathElement(path);
    if (element === null || (!element.isFile && !element.isDirectory)) {
      throw new Exception(`The asset '${path}' is not a file or a directory.`, {
        code: ERRORS.NOT_A_PATH_ELEMENT,
      });
    }
    const files = element.isFile ? [path] : await listFiles(path);
    for (const file of files) {
      if (!excludedNames.has(basename(file))) {
        assets.add(toUrlPath(outDir, file));
      }
    }
  }
  return [...assets];
};
