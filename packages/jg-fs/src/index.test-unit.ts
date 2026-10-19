// @vitest-environment node
import { describe, expect, test } from 'vitest';

import * as publicApi from './index.js';

describe('public API', () => {
  test('exports the same functions from both entries, under the same names', async () => {
    const syncApi = await import('./sync/index.js');

    expect(Object.keys(syncApi).sort()).toStrictEqual(Object.keys(publicApi).sort());
    expect(Object.keys(publicApi).sort()).toStrictEqual([
      'ERRORS',
      'acquireLock',
      'assertPrivateDirectory',
      'assertPrivateFile',
      'copyDirectory',
      'copyFile',
      'createDirectory',
      'createDirectorySymLink',
      'createFileSymLink',
      'createPrivateDirectory',
      'deleteDirectory',
      'deleteFile',
      'getDirectoryElements',
      'getPathElement',
      'isDirectory',
      'isFile',
      'isPathWithin',
      'pathExists',
      'readBoundedFile',
      'readBufferFile',
      'readDirectory',
      'readFile',
      'readJsonFile',
      'readPrivateFile',
      'readTextFile',
      'writeBufferFile',
      'writeFile',
      'writeFileAtomic',
      'writeJsonFile',
      'writePrivateFile',
      'writeTextFile',
    ]);
  });
});
