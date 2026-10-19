// @vitest-environment node
import { expect, test } from 'vitest';

import { isLocalDockerEndpoint } from './endpoint.js';

test.each([
  ['unix:///var/run/docker.sock', true],
  ['unix:///home/user/.docker/run/docker.sock', true],
  ['npipe:////./pipe/docker_engine', true],
  ['tcp://127.0.0.1:2375', false],
  ['tcp://docker.example.com:2376', false],
  ['ssh://deploy@build.example.com', false],
  ['fd://', false],
  ['unix://', false],
  ['npipe://', false],
  ['/var/run/docker.sock', false],
  ['', false],
  [undefined, false],
  [42, false],
])('isLocalDockerEndpoint(%o) -> %s', (host, expected) => {
  expect(isLocalDockerEndpoint(host)).toBe(expected);
});
