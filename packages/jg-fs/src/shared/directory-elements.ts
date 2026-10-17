import { sortRecords } from 'jg-utils';

import { DIRECTORY_ELEMENTS_DEFAULT_OPTIONS } from './constants.js';
import type { IDirectoryElementsOptions, IDirectoryPathElements, IPathElement } from './types.js';

/**
 * Builds the options getDirectoryElements uses, filling in the defaults and lowercasing the
 * extensions, so `.JSON` and `.json` match the same files.
 * @param options The options the caller gave.
 * @returns The complete options.
 */
export const buildDirectoryElementsOptions = (
  options?: Partial<IDirectoryElementsOptions>,
): IDirectoryElementsOptions => ({
  sortByKey: options?.sortByKey ?? DIRECTORY_ELEMENTS_DEFAULT_OPTIONS.sortByKey,
  sortOrder: options?.sortOrder ?? DIRECTORY_ELEMENTS_DEFAULT_OPTIONS.sortOrder,
  includeExts: (options?.includeExts ?? DIRECTORY_ELEMENTS_DEFAULT_OPTIONS.includeExts).map(
    (extension) => extension.toLowerCase(),
  ),
});

/**
 * Groups a directory's elements by kind, keeps only the files with an included extension, and
 * sorts each group.
 * @param elements The directory's elements.
 * @param options The complete options.
 * @returns The grouped, filtered, and sorted elements.
 */
export const groupDirectoryElements = (
  elements: IPathElement[],
  options: IDirectoryElementsOptions,
): IDirectoryPathElements => {
  const directories: IPathElement[] = [];
  const files: IPathElement[] = [];
  const symbolicLinks: IPathElement[] = [];
  elements.forEach((element) => {
    if (element.isDirectory) {
      directories.push(element);
    } else if (
      element.isFile &&
      (options.includeExts.length === 0 ||
        options.includeExts.includes(element.extName.toLowerCase()))
    ) {
      files.push(element);
    } else if (element.isSymbolicLink) {
      symbolicLinks.push(element);
    }
  });
  const compare = sortRecords(options.sortByKey, options.sortOrder);
  directories.sort(compare);
  files.sort(compare);
  symbolicLinks.sort(compare);
  return { directories, files, symbolicLinks };
};
