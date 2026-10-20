import type { Stats } from 'node:fs';
import { lstat } from 'node:fs/promises';

import { isMissingPathError, nonExistentDirectory, notADirectory } from '../../shared/index.js';

/**
 * Ensures a path is an existing directory, without following a symbolic link at the path.
 * @param path The path.
 * @returns A promise that resolves once the path is known to be a directory.
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the path doesn't exist
 * - NOT_A_DIRECTORY: if the path is not a directory
 */
export const assertExistingDirectory = async (path: string): Promise<void> => {
  let stats: Stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    throw isMissingPathError(error) ? nonExistentDirectory(path, error) : notADirectory(path);
  }
  if (!stats.isDirectory()) {
    throw notADirectory(path);
  }
};

/**
 * Maps items with an async function, running at most a fixed number of calls at once, and keeps
 * the results in the items' order.
 * @param items The items.
 * @param concurrency The most calls running at once.
 * @param mapper The async function.
 * @returns A promise that resolves to the results.
 */
export const mapWithConcurrency = async <TItem, TResult>(
  items: TItem[],
  concurrency: number,
  mapper: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> => {
  const results: TResult[] = new Array<TResult>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index] as TItem);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
};
