// @vitest-environment node
import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { resolveLocalDockerHost } from '../endpoint/index.js';
import {
  DOCKER_SETUP_TIMEOUT_SECONDS,
  TEST_IMAGE,
  createTestName,
  docker,
} from '../shared/docker.test-utils.js';
import { ERRORS } from '../shared/index.js';

import { inspectContainer } from './inspect.js';

describe('inspectContainer', () => {
  let host: string;
  const running = createTestName();
  const created = createTestName();
  const checked = createTestName();

  beforeAll(async () => {
    host = await resolveLocalDockerHost();
    await docker(host, [
      'run',
      '--detach',
      '--name',
      running,
      '--label',
      `jg-docker-test=${running}`,
      '--label',
      'jg-docker-test.empty=',
      '--publish',
      '127.0.0.1::6379',
      TEST_IMAGE,
    ]);
    await docker(host, [
      'create',
      '--name',
      created,
      '--label',
      `jg-docker-test=${created}`,
      TEST_IMAGE,
    ]);
    await docker(host, [
      'run',
      '--detach',
      '--name',
      checked,
      '--health-cmd',
      'redis-cli ping',
      '--health-interval',
      '1s',
      TEST_IMAGE,
    ]);
  }, DOCKER_SETUP_TIMEOUT_SECONDS * 1000);

  afterAll(async () => {
    await docker(host, ['rm', '--force', '--volumes', running, created, checked]);
  }, DOCKER_SETUP_TIMEOUT_SECONDS * 1000);

  test('reads a running container by its name, with the labels asked for and its ports', async () => {
    const id = await docker(host, [
      'inspect',
      '--type',
      'container',
      '--format',
      '{{.Id}}',
      running,
    ]);
    const published = await docker(host, ['port', running, '6379/tcp']);

    const inspection = await inspectContainer(running, {
      host,
      labels: ['jg-docker-test', 'jg-docker-test.empty', 'jg-docker-test.missing'],
    });

    expect(inspection).toStrictEqual({
      id,
      name: running,
      isRunning: true,
      health: null,
      labels: {
        'jg-docker-test': running,
        'jg-docker-test.empty': '',
        'jg-docker-test.missing': null,
      },
      ports: [
        {
          containerPort: 6379,
          protocol: 'tcp',
          hostIp: '127.0.0.1',
          hostPort: Number(published.split(':').at(-1)),
        },
      ],
    });
  });

  test('reads a container by a short ID', async () => {
    const id = await docker(host, [
      'inspect',
      '--type',
      'container',
      '--format',
      '{{.Id}}',
      running,
    ]);

    await expect(inspectContainer(id.slice(0, 12), { host })).resolves.toMatchObject({
      id,
      name: running,
      labels: {},
    });
  });

  test('reads a container that was created but never started', async () => {
    await expect(
      inspectContainer(created, { host, labels: ['jg-docker-test'] }),
    ).resolves.toMatchObject({
      name: created,
      isRunning: false,
      health: null,
      labels: { 'jg-docker-test': created },
      ports: [],
    });
  });

  test("reads a container's healthcheck status", async () => {
    const { health } = await inspectContainer(checked, { host });

    expect(['starting', 'healthy']).toContain(health);
  });

  test.each([
    ['a container that does not exist', () => createTestName()],
    ['an image, which is not a container', () => TEST_IMAGE],
  ])('throws DOCKER_CONTAINER_NOT_FOUND for %s', async (_description, ref) => {
    await expectToRejectCode(inspectContainer(ref(), { host }), ERRORS.DOCKER_CONTAINER_NOT_FOUND);
  });

  test('fails when the endpoint does not answer', async () => {
    let error: unknown;
    try {
      await inspectContainer(running, { host: 'unix:///tmp/jg-docker-test-missing.sock' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand: 'inspect', exitCode: 1 },
    });
  });

  test.each([
    ['an empty reference', '', {}],
    ['a reference that reads as an option', '--help', {}],
    ['an empty host', 'app', { host: '' }],
    ['a label key with a space', 'app', { labels: ['owner name'] }],
    ['a label key that is a template', 'app', { labels: ['{{.Config.Env}}'] }],
    ['labels that are not an array', 'app', { labels: 'owner' }],
  ])('rejects %s', async (_description, ref, overrides) => {
    await expectToRejectCode(
      inspectContainer(ref, { host, ...overrides } as Parameters<typeof inspectContainer>[1]),
      ERRORS.DOCKER_INVALID_ARGUMENT,
    );
  });
});
