// @vitest-environment node
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { resolveLocalDockerHost } from '../endpoint/index.js';
import {
  DOCKER_SETUP_TIMEOUT_SECONDS,
  TEST_IMAGE,
  createTemporaryDirectory,
  createTestName,
  docker,
} from '../shared/docker.test-utils.js';
import { ERRORS } from '../shared/index.js';

import { listComposeServices } from './compose.js';
import { findPublicPorts } from './utilities.js';

// a cache published on loopback with a healthcheck, a service only exposed to the others, and one
// behind a profile that never starts
const COMPOSE_FILE = `services:
  cache:
    image: ${TEST_IMAGE}
    ports:
      - '127.0.0.1::6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 1s
      timeout: 2s
      retries: 30
  quiet:
    image: ${TEST_IMAGE}
    expose:
      - '6379'
  extra:
    image: ${TEST_IMAGE}
    profiles: ['extra']
`;

describe('listComposeServices', () => {
  let directory: string;
  let host: string;
  const project = createTestName();

  beforeAll(async () => {
    directory = await createTemporaryDirectory('compose');
    host = await resolveLocalDockerHost();
    await writeFile(join(directory, 'compose.yaml'), COMPOSE_FILE);
    await docker(
      host,
      ['compose', '--project-name', project, 'up', '--detach', '--wait'],
      directory,
    );
  }, DOCKER_SETUP_TIMEOUT_SECONDS * 1000);

  afterAll(async () => {
    try {
      await docker(
        host,
        ['compose', '--project-name', project, 'down', '--volumes', '--remove-orphans'],
        directory,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, DOCKER_SETUP_TIMEOUT_SECONDS * 1000);

  test("lists the project's running services, with their health and ports", async () => {
    const services = await listComposeServices({ cwd: directory, host, projectName: project });
    const byService = new Map(services.map((service) => [service.service, service]));

    expect([...byService.keys()].sort()).toStrictEqual(['cache', 'quiet']);
    expect(byService.get('cache')).toMatchObject({
      name: `${project}-cache-1`,
      project,
      state: 'running',
      health: 'healthy',
      exitCode: 0,
    });
    expect(byService.get('cache')?.publishers).toStrictEqual([
      {
        url: '127.0.0.1',
        targetPort: 6379,
        publishedPort: Number(
          (await docker(host, ['port', `${project}-cache-1`, '6379/tcp'])).split(':').at(-1),
        ),
        protocol: 'tcp',
      },
    ]);
    expect(byService.get('cache')?.id).toMatch(/^[0-9a-f]{64}$/);
    expect(byService.get('quiet')).toMatchObject({
      state: 'running',
      health: '',
      publishers: [{ url: '', targetPort: 6379, publishedPort: 0, protocol: 'tcp' }],
    });
    expect(findPublicPorts(services)).toStrictEqual([]);
  });

  test('lists only the services asked for', async () => {
    const services = await listComposeServices({
      cwd: directory,
      host,
      projectName: project,
      services: ['cache'],
    });

    expect(services.map(({ service }) => service)).toStrictEqual(['cache']);
  });

  test('lists nothing for a profile service that never started', async () => {
    await expect(
      listComposeServices({
        cwd: directory,
        host,
        projectName: project,
        profiles: ['extra'],
        services: ['extra'],
      }),
    ).resolves.toStrictEqual([]);
  });

  test(
    'lists a stopped service unless all is false',
    async () => {
      await docker(host, ['compose', '--project-name', project, 'stop', 'quiet'], directory);
      try {
        const all = await listComposeServices({ cwd: directory, host, projectName: project });
        const running = await listComposeServices({
          cwd: directory,
          host,
          projectName: project,
          all: false,
        });

        expect(all.find(({ service }) => service === 'quiet')?.state).toBe('exited');
        expect(running.map(({ service }) => service)).toStrictEqual(['cache']);
      } finally {
        await docker(host, ['compose', '--project-name', project, 'start', 'quiet'], directory);
      }
    },
    DOCKER_SETUP_TIMEOUT_SECONDS * 1000,
  );

  test('lists nothing for a project without containers', async () => {
    await expect(
      listComposeServices({ cwd: directory, host, projectName: createTestName() }),
    ).resolves.toStrictEqual([]);
  });

  test('fails for a Compose file that is not valid', async () => {
    const broken = join(directory, 'broken');
    await mkdir(broken, { recursive: true });
    await writeFile(join(broken, 'compose.yaml'), 'services: [\n');

    let error: unknown;
    try {
      await listComposeServices({ cwd: broken, host });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand: 'compose ps', exitCode: 1 },
    });
  });

  test.each([
    ['an empty host', { host: '' }],
    ['a project name with capitals', { projectName: 'Jg-Docker' }],
    ['a profile that reads as an option', { profiles: ['--all'] }],
    ['a service that reads as an option', { services: ['--quiet'] }],
    ['services that are not an array', { services: 'cache' }],
  ])('rejects %s', async (_description, overrides) => {
    await expectToRejectCode(
      listComposeServices({
        cwd: directory,
        host,
        projectName: project,
        ...overrides,
      } as Parameters<typeof listComposeServices>[0]),
      ERRORS.DOCKER_INVALID_ARGUMENT,
    );
  });
});
