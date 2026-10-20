// @vitest-environment node
import { mkdir, writeFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

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
import { removeContainer, startContainer } from './container.js';

// the label every container these tests start carries, so their cleanup finds each one
const RUN_LABEL = 'jg-local-docker-test.run';
const RUN_ID = createTestName();

const IS_WINDOWS = process.platform === 'win32';

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

describe('startContainer', () => {
  test('starts a container with its port on 127.0.0.1, which removeContainer then removes', async () => {
    const options = containerOptions();

    const container = await startContainer(options);

    expect(container).toMatchObject({
      name: options.name,
      isRunning: true,
      labels: options.labels,
      ports: [{ containerPort: 6379, protocol: 'tcp', hostIp: '127.0.0.1' }],
    });
    expect(container.ports[0]?.hostPort).toBeGreaterThan(0);
    await expect(removeContainer(options.name, options)).resolves.toBe(true);
    expect(await findByName(options.name)).toStrictEqual([]);
  });

  test('removes the container when a port ends up published beyond 127.0.0.1', async () => {
    const options = { ...containerOptions(), createArgs: ['--publish', '6380'] };

    await expectToRejectCode(
      startContainer(options),
      ERRORS.DOCKER_PORTS_NOT_LOOPBACK,
      "The container's ports aren't each published once on 127.0.0.1.",
    );
    expect(await findByName(options.name)).toStrictEqual([]);
  });

  test('removes the container when it fails to start', async () => {
    const options = { ...containerOptions(), createArgs: ['--entrypoint', '/no/such/program'] };

    await expect(startContainer(options)).rejects.toMatchObject({
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand: 'start' },
    });
    expect(await findByName(options.name)).toStrictEqual([]);
  });

  test('refuses a name another container has, leaving that one alone', async () => {
    const options = containerOptions();
    await startContainer(options);

    await expect(startContainer(options)).rejects.toMatchObject({
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand: 'create' },
    });
    expect(await findByName(options.name)).toHaveLength(1);
    await removeContainer(options.name, options);
  });

  test('creates nothing when the signal aborted first', async () => {
    const options = containerOptions();
    const reason = new Error('Stopped.');

    await expect(startContainer({ ...options, signal: AbortSignal.abort(reason) })).rejects.toBe(
      reason,
    );
    expect(await findByName(options.name)).toStrictEqual([]);
  });
});

describe('removeContainer', () => {
  test('refuses a container whose labels differ, and leaves it running', async () => {
    const options = containerOptions();
    await startContainer(options);

    await expectToRejectCode(
      removeContainer(options.name, {
        host,
        labels: { ...options.labels, 'jg-local-docker-test.nonce': 'another' },
      }),
      ERRORS.DOCKER_CONTAINER_NOT_OWNED,
      "The container isn't the one its name and labels describe.",
    );
    expect(await findByName(options.name)).toHaveLength(1);
    await removeContainer(options.name, options);
  });

  test('refuses a container found by an ID that starts with the name', async () => {
    const options = containerOptions();
    const { id } = await startContainer(options);

    await expectToRejectCode(
      removeContainer(id.slice(0, 12), options),
      ERRORS.DOCKER_CONTAINER_NOT_OWNED,
    );
    await removeContainer(options.name, options);
  });

  test('removes a container that never started', async () => {
    const options = containerOptions();
    await docker(host, [
      'create',
      '--name',
      options.name,
      ...Object.entries(options.labels).flatMap(([key, value]) => ['--label', `${key}=${value}`]),
      TEST_IMAGE,
    ]);

    await expect(removeContainer(options.name, options)).resolves.toBe(true);
    expect(await findByName(options.name)).toStrictEqual([]);
  });

  test('returns false for a container that is already gone', async () => {
    const options = containerOptions();

    await expect(removeContainer(options.name, options)).resolves.toBe(false);
  });
});

/*
 * A docker program that answers each subcommand from FAKE_* variables, for failures the real one
 * doesn't produce on demand. Its arguments start with --host and the endpoint, then the
 * subcommand. Each inspect reads the next of FAKE_INSPECT_OUT_1, _2, ..., counted in FAKE_STATE.
 */
const SCRIPTED_DOCKER = `#!/bin/sh
case "$3" in
  create) printf '%s' "$FAKE_CREATE_OUT"; exit 0 ;;
  start) printf '%s' "$FAKE_START_ERR" >&2; exit "\${FAKE_START_EXIT:-0}" ;;
  inspect)
    count=$(cat "$FAKE_STATE/inspects" 2>/dev/null || echo 0)
    count=$((count + 1))
    echo "$count" > "$FAKE_STATE/inspects"
    eval "out=\\$FAKE_INSPECT_OUT_$count"
    if [ -z "$out" ]; then echo 'Error: No such container: x' >&2; exit 1; fi
    printf '%s' "$out"; exit 0 ;;
  stop) printf '%s' "$FAKE_STOP_ERR" >&2; exit "\${FAKE_STOP_EXIT:-0}" ;;
  rm)
    if [ -n "$FAKE_RM_SLEEP" ]; then sleep "$FAKE_RM_SLEEP"; fi
    printf '%s' "$FAKE_RM_ERR" >&2; exit "\${FAKE_RM_EXIT:-0}" ;;
esac
exit 0
`;

const FAKE_ID = 'a'.repeat(64);

/**
 * Builds an inspection as the real docker writes it with the package's template.
 * @param fields The fields to change.
 * @returns The JSON.
 */
const inspectionJson = (fields: Record<string, unknown> = {}): string =>
  JSON.stringify({
    id: FAKE_ID,
    name: '/scripted',
    state: { Running: true },
    labels: { 'jg-local-docker-test.nonce': 'scripted' },
    ports: { '6379/tcp': [{ HostIp: '127.0.0.1', HostPort: '49153' }] },
    ...fields,
  });

describe.skipIf(IS_WINDOWS)('startContainer and removeContainer with a scripted docker', () => {
  let bin: string;
  let state: string;

  beforeAll(async () => {
    const directory = await createTemporaryDirectory('scripted');
    bin = join(directory, 'bin');
    await mkdir(bin);
    await writeFile(join(bin, 'docker'), SCRIPTED_DOCKER, { mode: 0o755 });
  });

  /**
   * Builds the environment the scripted docker runs with, with a fresh inspect count.
   * @param variables The FAKE_* variables.
   * @returns A promise that resolves to the environment.
   */
  const scriptedEnv = async (variables: Record<string, string>): Promise<NodeJS.ProcessEnv> => {
    state = await createTemporaryDirectory('state');
    return {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env['PATH'] ?? ''}`,
      FAKE_STATE: state,
      ...variables,
    };
  };

  const scripted = {
    host: 'unix:///var/run/docker.sock',
    name: 'scripted',
    labels: { 'jg-local-docker-test.nonce': 'scripted' },
    image: TEST_IMAGE,
    ports: [6379],
  };

  test('refuses output from create that is no container ID', async () => {
    await expectToRejectCode(
      startContainer({ ...scripted, env: await scriptedEnv({ FAKE_CREATE_OUT: 'Created' }) }),
      ERRORS.DOCKER_OUTPUT_INVALID,
    );
  });

  test.each([
    ['another ID', { id: 'b'.repeat(64) }],
    ['another name', { name: '/other' }],
  ])('refuses a started container with %s, removing the one it created', async (_, fields) => {
    await expectToRejectCode(
      startContainer({
        ...scripted,
        env: await scriptedEnv({
          FAKE_CREATE_OUT: FAKE_ID,
          FAKE_INSPECT_OUT_1: inspectionJson(fields),
        }),
      }),
      ERRORS.DOCKER_CONTAINER_NOT_OWNED,
    );
  });

  test('throws the start failure when the container is already gone at removal', async () => {
    await expect(
      startContainer({
        ...scripted,
        env: await scriptedEnv({
          FAKE_CREATE_OUT: FAKE_ID,
          FAKE_START_EXIT: '1',
          FAKE_RM_EXIT: '1',
          FAKE_RM_ERR: 'Error: No such container: x',
        }),
      }),
    ).rejects.toMatchObject({ code: ERRORS.DOCKER_COMMAND_FAILED, data: { subcommand: 'start' } });
  });

  test('reports a container it failed to remove after a failed start', async () => {
    const error: unknown = await startContainer({
      ...scripted,
      env: await scriptedEnv({
        FAKE_CREATE_OUT: FAKE_ID,
        FAKE_START_EXIT: '1',
        FAKE_RM_EXIT: '1',
        FAKE_RM_ERR: 'Error: the daemon is busy',
      }),
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand: 'rm', containerId: FAKE_ID, removalErrorCode: null },
      cause: { code: ERRORS.DOCKER_COMMAND_FAILED, data: { subcommand: 'start' } },
    });
  });

  test("reports the removal's own error code when it couldn't run", async () => {
    const error: unknown = await startContainer({
      ...scripted,
      timeoutSeconds: 1,
      env: await scriptedEnv({
        FAKE_CREATE_OUT: FAKE_ID,
        FAKE_START_EXIT: '1',
        FAKE_RM_SLEEP: '5',
      }),
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand: 'rm', removalErrorCode: 'PROCESS_TIMED_OUT' },
    });
  });

  test('treats a container removed meanwhile as removed', async () => {
    await expect(
      removeContainer('scripted', {
        ...scripted,
        env: await scriptedEnv({
          FAKE_INSPECT_OUT_1: inspectionJson(),
          FAKE_STOP_EXIT: '1',
          FAKE_STOP_ERR: 'Error response from daemon: No such container: x',
          FAKE_RM_EXIT: '1',
          FAKE_RM_ERR: 'Error: No such container: x',
        }),
      }),
    ).resolves.toBe(true);
  });

  test('throws when the removal fails', async () => {
    await expect(
      removeContainer('scripted', {
        ...scripted,
        env: await scriptedEnv({
          FAKE_INSPECT_OUT_1: inspectionJson({ state: { Running: false } }),
          FAKE_RM_EXIT: '1',
          FAKE_RM_ERR: 'Error: the daemon is busy',
        }),
      }),
    ).rejects.toMatchObject({ code: ERRORS.DOCKER_COMMAND_FAILED, data: { subcommand: 'rm' } });
  });

  test('throws when the container is still there after its removal', async () => {
    await expect(
      removeContainer('scripted', {
        ...scripted,
        env: await scriptedEnv({
          FAKE_INSPECT_OUT_1: inspectionJson(),
          FAKE_INSPECT_OUT_2: inspectionJson(),
        }),
      }),
    ).rejects.toMatchObject({
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand: 'rm', containerId: FAKE_ID },
    });
  });

  test.each([
    ['first', { FAKE_INSPECT_OUT_1: 'not json' }],
    ['confirming', { FAKE_INSPECT_OUT_1: inspectionJson(), FAKE_INSPECT_OUT_2: 'not json' }],
  ])(
    'passes on what the %s inspection throws, other than a missing container',
    async (_, variables) => {
      await expectToRejectCode(
        removeContainer('scripted', { ...scripted, env: await scriptedEnv(variables) }),
        ERRORS.DOCKER_OUTPUT_INVALID,
      );
    },
  );
});
