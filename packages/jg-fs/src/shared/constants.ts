import type { IDirectoryElementsOptions } from './types.js';

// the options getDirectoryElements uses for anything the caller leaves out
export const DIRECTORY_ELEMENTS_DEFAULT_OPTIONS: IDirectoryElementsOptions = {
  sortByKey: 'baseName',
  sortOrder: 'asc',
  includeExts: [],
};

// how many entries the async getDirectoryElements reads at once, so large directories don't open a stat per entry at the same time
export const DIRECTORY_ELEMENTS_CONCURRENCY = 32;

// the number of bytes readBoundedFile reads per call
export const BOUNDED_READ_CHUNK_SIZE = 65536;

// the waits, in milliseconds, between the attempts of a rename Windows refuses while another
// process, such as an antivirus scanner or a search indexer, holds the file: about 4 seconds in all
export const RENAME_RETRY_DELAYS_MS: readonly number[] = [
  10, 20, 40, 80, 160, 320, 640, 1000, 1000, 1000,
];
