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
