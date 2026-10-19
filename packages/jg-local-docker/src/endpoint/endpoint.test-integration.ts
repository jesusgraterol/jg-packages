// @vitest-environment node
import { rm } from 'node:fs/promises';

import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { runDocker } from '../run-docker/index.js';
import { createTemporaryDirectory, writeFakeDocker } from '../shared/docker.test-utils.js';
import { ERRORS } from '../shared/index.js';

import { resolveLocalDockerHost } from './endpoint.js';

// the fake docker programs are POSIX shell scripts
const IS_WINDOWS = process.platform === 'win32';

/**
 * Captures what a promise rejects with.
 * @param promise The promise.
 * @returns A promise that resolves to the rejection, or undefined when it resolves.
 */
const captureRejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('resolveLocalDockerHost', () => {
  let directory: string;
  let fakeBin: string;

  beforeAll(async () => {
    directory = await createTemporaryDirectory('endpoint');
    fakeBin = await writeFakeDocker(directory);
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test("gives the current context's local endpoint", async () => {
    const { stdout } = await runDocker([
      'context',
      'inspect',
      '--format',
      '{{json .Endpoints.docker.Host}}',
    ]);

    const host = await resolveLocalDockerHost();

    expect(host).toBe(JSON.parse(stdout));
    expect(host).toMatch(/^(?:unix|npipe):\/\//);
  });

  test('gives a local DOCKER_HOST, which the context then reports', async () => {
    const env = { ...process.env, DOCKER_HOST: 'unix:///tmp/jg-local-docker-test.sock' };

    await expect(resolveLocalDockerHost({ env })).resolves.toBe(
      'unix:///tmp/jg-local-docker-test.sock',
    );
  });

  test('treats an empty DOCKER_HOST as unset', async () => {
    const host = await resolveLocalDockerHost();

    await expect(
      resolveLocalDockerHost({ env: { ...process.env, DOCKER_HOST: '' } }),
    ).resolves.toBe(host);
  });

  test.each(['tcp://127.0.0.1:2375', 'ssh://deploy@build.example.com'])(
    'refuses a DOCKER_HOST of %s before running docker',
    async (dockerHost) => {
      const error = await captureRejection(
        resolveLocalDockerHost({ env: { ...process.env, DOCKER_HOST: dockerHost } }),
      );

      expect(error).toMatchObject({
        code: ERRORS.DOCKER_ENDPOINT_NOT_LOCAL,
        data: { source: 'DOCKER_HOST' },
      });
      expect(JSON.stringify(error)).not.toContain('deploy');
    },
  );

  test('fails for a context that does not exist', async () => {
    const error = await captureRejection(
      resolveLocalDockerHost({
        env: {
          ...process.env,
          DOCKER_HOST: undefined,
          DOCKER_CONTEXT: 'jg-local-docker-test-missing',
        },
      }),
    );

    expect(error).toMatchObject({
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand: 'context inspect', exitCode: 1 },
    });
  });

  describe.skipIf(IS_WINDOWS)('a context docker reports', () => {
    /**
     * Builds the environment that runs the fake docker with an output.
     * @param output What it prints.
     * @param dockerHost DOCKER_HOST's value, if any.
     * @returns The environment.
     */
    const fakeEnv = (output: string, dockerHost?: string): NodeJS.ProcessEnv => ({
      PATH: fakeBin,
      JG_DOCKER_FAKE_OUTPUT: output,
      ...(dockerHost === undefined ? {} : { DOCKER_HOST: dockerHost }),
    });

    test('refuses a context whose endpoint is not local', async () => {
      const error = await captureRejection(
        resolveLocalDockerHost({ env: fakeEnv('"tcp://build.example.com:2376"\n') }),
      );

      expect(error).toMatchObject({
        code: ERRORS.DOCKER_ENDPOINT_NOT_LOCAL,
        data: { source: 'context' },
      });
    });

    test('refuses a context whose endpoint is not DOCKER_HOST', async () => {
      await expectToRejectCode(
        resolveLocalDockerHost({
          env: fakeEnv('"unix:///var/run/docker.sock"\n', 'unix:///run/user/1000/docker.sock'),
        }),
        ERRORS.DOCKER_ENDPOINT_NOT_LOCAL,
      );
    });

    test.each(['', 'unix:///var/run/docker.sock', '42', 'null'])(
      'rejects the output %o',
      async (output) => {
        await expectToRejectCode(
          resolveLocalDockerHost({ env: fakeEnv(output) }),
          ERRORS.DOCKER_OUTPUT_INVALID,
        );
      },
    );
  });
});
