// @vitest-environment node
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import { resolveLocalDockerHost } from '../endpoint/index.js';
import {
  createTemporaryDirectory,
  createTestName,
  docker,
  DOCKER_SETUP_TIMEOUT_SECONDS,
  TEST_IMAGE,
} from '../shared/docker.test-utils.js';
import { ERRORS } from '../shared/index.js';
import { startContainer, removeContainer } from './container.js';
import { startOwnedContainer } from './owned-container.js';
import { buildCreateArgs } from './utilities.js';

// the label every container these tests start carries, so their cleanup finds each one
const RUN_LABEL = 'jg-local-docker-test.owned-run';
const RUN_ID = createTestName();

const OWNER_SCRIPT = fileURLToPath(new URL('./owner.js', import.meta.url));

let host: string;

/**
 * Lists the containers with a name, running or not.
 * @param name The name.
 * @returns A promise that resolves to their IDs.
 */
const findByName = async (name: string): Promise<string[]> =>
  (await docker(host, ['ps', '--all', '--quiet', '--filter', `name=^/${name}$`]))
    .split('\n')
    .filter(Boolean);

/**
 * Builds the options of a container these tests start, with a fresh name and nonce.
 * @returns The options.
 */
const containerOptions = () => {
  const name = createTestName();
  return {
    host,
    name,
    labels: { [RUN_LABEL]: RUN_ID, 'jg-local-docker-test.nonce': name },
    image: TEST_IMAGE,
    ports: [6379],
  };
};

beforeAll(async () => {
  host = await resolveLocalDockerHost();
  await docker(host, ['pull', TEST_IMAGE]);
}, DOCKER_SETUP_TIMEOUT_SECONDS * 1000);

afterEach(async () => {
  const leftovers = await docker(host, [
    'ps',
    '--all',
    '--quiet',
    '--filter',
    `label=${RUN_LABEL}=${RUN_ID}`,
  ]);
  if (leftovers !== '') {
    await docker(host, ['rm', '--force', '--volumes', ...leftovers.split('\n')]);
  }
  // a test that left a container behind fails, after its container is removed
  expect(leftovers).toBe('');
});

describe('startOwnedContainer', () => {
  test('starts a container that release removes, once', async () => {
    const options = containerOptions();

    const { container, release } = await startOwnedContainer(options);

    expect(container).toMatchObject({
      name: options.name,
      isRunning: true,
      ports: [{ containerPort: 6379, hostIp: '127.0.0.1' }],
    });
    await release();
    await release();
    expect(await findByName(options.name)).toStrictEqual([]);
  });

  test('has its owner remove the container when a check after the creation fails', async () => {
    const options = { ...containerOptions(), createArgs: ['--publish', '127.0.0.1::6380'] };

    await expectToRejectCode(startOwnedContainer(options), ERRORS.DOCKER_PORTS_NOT_LOOPBACK);
    expect(await findByName(options.name)).toStrictEqual([]);
  });

  test('reports a creation that failed, leaving the container with that name alone', async () => {
    const options = containerOptions();
    await startContainer(options);

    const error: unknown = await startOwnedContainer(options).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand: 'create', exitCode: expect.any(Number) as unknown },
    });
    expect(await findByName(options.name)).toHaveLength(1);
    await removeContainer(options.name, options);
  });

  test('reports a creation that could not run docker at all', async () => {
    const empty = await createTemporaryDirectory('no-docker');

    const error: unknown = await startOwnedContainer({
      ...containerOptions(),
      env: { ...process.env, PATH: empty },
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand: 'create', exitCode: null },
    });
  });

  test('throws DOCKER_OWNER_FAILED when the owner process fails', async () => {
    await expectToRejectCode(
      startOwnedContainer({
        ...containerOptions(),
        env: { ...process.env, NODE_OPTIONS: '--require=/no/such/jg-local-docker-preload.cjs' },
      }),
      ERRORS.DOCKER_OWNER_FAILED,
      "The container's owner process failed.",
    );
  });

  test('removes the container it was creating when the signal aborts', async () => {
    const options = containerOptions();
    const controller = new AbortController();
    const reason = new Error('Stopped.');

    const starting = startOwnedContainer({ ...options, signal: controller.signal });
    controller.abort(reason);

    await expect(starting).rejects.toBe(reason);
    expect(await findByName(options.name)).toStrictEqual([]);
  });
});

describe.skipIf(process.platform === 'win32')('the owner process', () => {
  /**
   * Forks an owner, has it create a container, and waits for its ID.
   * @param options The container's options.
   * @returns A promise that resolves to the owner and the exit code it will exit with.
   */
  const startOwner = async (options: ReturnType<typeof containerOptions>) => {
    const owner = fork(OWNER_SCRIPT, [], {
      execArgv: [],
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    const exitCode = new Promise<number | null>((resolve) => owner.once('exit', resolve));
    const created = new Promise<unknown>((resolve) => owner.once('message', resolve));
    owner.send({ type: 'create', host, args: buildCreateArgs(options), timeoutSeconds: 30 });
    expect(await created).toMatchObject({
      type: 'created',
      id: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
    });
    return { owner, exitCode };
  };

  test.each([['SIGINT'], ['SIGTERM']] as const)(
    'removes its container and exits with 0 on %s, even when it comes twice',
    async (signal) => {
      const options = containerOptions();
      const { owner, exitCode } = await startOwner(options);
      expect(await findByName(options.name)).toHaveLength(1);

      owner.kill(signal);
      owner.kill(signal);

      await expect(exitCode).resolves.toBe(0);
      expect(await findByName(options.name)).toStrictEqual([]);
    },
  );

  test('removes its container and exits with 0 when its parent disconnects', async () => {
    const options = containerOptions();
    const { owner, exitCode } = await startOwner(options);

    owner.disconnect();

    await expect(exitCode).resolves.toBe(0);
    expect(await findByName(options.name)).toStrictEqual([]);
  });

  test('exits with 0 at once when it never created a container', async () => {
    const owner = fork(OWNER_SCRIPT, [], {
      execArgv: [],
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    const exitCode = new Promise<number | null>((resolve) => owner.once('exit', resolve));

    owner.disconnect();

    await expect(exitCode).resolves.toBe(0);
  });
});
