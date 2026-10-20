// @vitest-environment node
import { expectToRejectCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { removeContainer, startContainer } from './container.js';
import { startOwnedContainer } from './owned-container.js';
import type { IStartContainerOptions } from './types.js';

// options that are valid, which each test breaks in one place
const VALID_OPTIONS: IStartContainerOptions = {
  host: 'unix:///var/run/docker.sock',
  name: 'jg-local-docker-unit',
  labels: { 'jg-local-docker-test': 'unit' },
  image: 'redis:8.6.2-alpine',
  ports: [6379],
};

describe('startContainer and startOwnedContainer', () => {
  test.each([
    ['host', { host: '' }],
    ['host', { host: '--tls' }],
    ['name', { name: 'a' }],
    ['name', { name: '-name' }],
    ['name', { name: 'with space' }],
    ['labels', { labels: {} }],
    ['labels', { labels: { 'bad key': 'x' } }],
    ['labels', { labels: { key: 'a\0b' } }],
    ['labels', { labels: ['key'] }],
    ['image', { image: '' }],
    ['image', { image: '--rm' }],
    ['ports', { ports: [0] }],
    ['ports', { ports: [65_536] }],
    ['ports', { ports: [1.5] }],
    ['ports', { ports: [6379, 6379] }],
    ['ports', { ports: '6379' }],
    ['createArgs', { createArgs: ['--memory\0'] }],
    ['command', { command: 'redis-server' }],
  ])(
    'refuses an invalid %s with DOCKER_INVALID_ARGUMENT before running docker',
    async (argument, override) => {
      const options = { ...VALID_OPTIONS, ...override } as IStartContainerOptions;

      for (const start of [startContainer, startOwnedContainer]) {
        const error: unknown = await start(options).catch((caught: unknown) => caught);
        expect(error).toMatchObject({ code: ERRORS.DOCKER_INVALID_ARGUMENT, data: { argument } });
      }
    },
  );

  test('starts no owner when the signal aborted first', async () => {
    const reason = new Error('Stopped.');

    await expect(
      startOwnedContainer({ ...VALID_OPTIONS, signal: AbortSignal.abort(reason) }),
    ).rejects.toBe(reason);
  });
});

describe('removeContainer', () => {
  test.each([
    ['host', 'jg-local-docker-unit', { host: '' }],
    ['name', '-name', {}],
    ['labels', 'jg-local-docker-unit', { labels: {} }],
  ])('refuses an invalid %s with DOCKER_INVALID_ARGUMENT', async (argument, name, override) => {
    const removal = removeContainer(name, {
      host: VALID_OPTIONS.host,
      labels: VALID_OPTIONS.labels,
      ...override,
    });

    await expectToRejectCode(removal, ERRORS.DOCKER_INVALID_ARGUMENT, "An argument isn't valid.");
    await expect(removal).rejects.toMatchObject({ data: { argument } });
  });
});
