import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { readServiceWorkerConfig } from './config.js';

// a valid base config
const BASE_CONFIG = {
  outDir: 'dist',
  cacheNamePrefix: 'test-app',
  template: 'base',
  includeToPrecache: ['/'],
  excludeFilesFromPrecache: [],
  excludeMIMETypesFromCache: [],
};

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'jg-sw-config-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('readServiceWorkerConfig', () => {
  test('reads and validates a config file', async () => {
    const path = join(directory, 'jg-sw.config.json');
    await writeFile(path, JSON.stringify(BASE_CONFIG));

    await expect(readServiceWorkerConfig(path)).resolves.toStrictEqual(BASE_CONFIG);
  });

  test('throws FAILED_TO_READ_BASE_CONFIG when the file is missing or not JSON', async () => {
    const path = join(directory, 'jg-sw.config.json');
    await expectToRejectCode(
      readServiceWorkerConfig(path),
      ERRORS.FAILED_TO_READ_BASE_CONFIG,
      `Unable to read the service worker config '${path}'`,
    );

    await writeFile(path, '{ "outDir": ');
    await expectToRejectCode(
      readServiceWorkerConfig(path),
      ERRORS.FAILED_TO_READ_BASE_CONFIG,
      `Unable to read the service worker config '${path}'`,
    );
  });

  test('names the file when its config is invalid', async () => {
    const path = join(directory, 'jg-sw.config.json');
    await writeFile(path, JSON.stringify({ ...BASE_CONFIG, cacheNamePrefix: 'Bad Prefix' }));

    await expectToRejectCode(
      readServiceWorkerConfig(path),
      ERRORS.FAILED_TO_READ_BASE_CONFIG,
      `The service worker config '${path}' is invalid: cacheNamePrefix:`,
    );
  });
});
