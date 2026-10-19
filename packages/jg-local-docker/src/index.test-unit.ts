// @vitest-environment node
import { describe, expect, test } from 'vitest';

import * as publicApi from './index.js';

describe('public API', () => {
  test('exports exactly the documented functions and constants', () => {
    expect(Object.keys(publicApi).sort()).toStrictEqual([
      'DEFAULT_DOCKER_MAX_OUTPUT_BYTES',
      'DEFAULT_DOCKER_TIMEOUT_SECONDS',
      'ERRORS',
      'findPublicPorts',
      'inspectContainer',
      'isLocalDockerEndpoint',
      'listComposeServices',
      'parseComposePs',
      'resolveLocalDockerHost',
      'runDocker',
    ]);
  });
});
