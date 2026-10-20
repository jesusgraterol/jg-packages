// @vitest-environment node
import { describe, expect, test } from 'vitest';

import * as publicApi from './index.js';

describe('public API', () => {
  test('exports exactly the documented functions and constants', () => {
    expect(Object.keys(publicApi).sort()).toStrictEqual([
      'DEFAULT_GIT_MAX_OUTPUT_BYTES',
      'DEFAULT_GIT_SSH_COMMAND',
      'DEFAULT_GIT_TIMEOUT_SECONDS',
      'ERRORS',
      'assertGitSucceeded',
      'calculateGitBlobObjectId',
      'createGitEnvironment',
      'fetchCommit',
      'getRemoteUrl',
      'isWorkingTreeClean',
      'listUntrackedFiles',
      'readChangedPaths',
      'readConfigBoolean',
      'readFileAtRevision',
      'readGitVersion',
      'readIndexEntries',
      'readRemoteRefs',
      'readStatus',
      'readTopLevel',
      'resolveCommit',
      'runGit',
    ]);
  });
});
