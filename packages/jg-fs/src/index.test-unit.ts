// @vitest-environment node
import { describe, expect, test } from 'vitest';

import * as publicApi from './index.js';

describe('public API', () => {
  test('exports the common functions from both entries and the streaming APIs from the root', async () => {
    const syncApi = await import('./sync/index.js');
    const { hashFile, installVerifiedFile, ...common } = publicApi;

    expect(hashFile).toBeTypeOf('function');
    expect(installVerifiedFile).toBeTypeOf('function');
    expect(Object.keys(syncApi).sort()).toStrictEqual(Object.keys(common).sort());
    expect(Object.keys(common).sort()).toStrictEqual([
      'ERRORS',
      'acquireLock',
      'assertNoLinksBelow',
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
      'readLockOwner',
      'readPrivateFile',
      'readTextFile',
      'writeBufferFile',
      'writeFile',
      'writeFileAtomic',
      'writeFileAtomicIfUnchanged',
      'writeJsonFile',
      'writePrivateFile',
      'writeTextFile',
    ]);
  });
});
