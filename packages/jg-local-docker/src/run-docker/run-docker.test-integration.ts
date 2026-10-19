// @vitest-environment node
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

import { getErrorCode } from 'jg-exception';
import { expectToRejectCode } from 'jg-exception/testing';
import { ERRORS as PROCESS_ERRORS } from 'jg-process';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { resolveLocalDockerHost } from '../endpoint/index.js';
import { createTemporaryDirectory, writeFakeDocker } from '../shared/docker.test-utils.js';
import { ERRORS } from '../shared/index.js';

import { runDocker } from './run-docker.js';

// the fake docker programs are POSIX shell scripts
const IS_WINDOWS = process.platform === 'win32';

describe('runDocker', () => {
  let directory: string;
  let host: string;

  beforeAll(async () => {
    directory = await createTemporaryDirectory('run');
    host = await resolveLocalDockerHost();
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test('runs a command at the endpoint, resolving with the exit code and the output', async () => {
    const result = await runDocker(['version', '--format', '{{json .Server.Os}}'], { host });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toBeTypeOf('string');
  });

  test('resolves a failed command with its exit code', async () => {
    const result = await runDocker(
      ['inspect', '--type', 'container', 'jg-local-docker-test-missing'],
      {
        host,
      },
    );

    expect(result.exitCode).toBe(1);
  });

  test('pins the endpoint with --host, whatever the context says', async () => {
    const env = { ...process.env, DOCKER_CONTEXT: 'jg-local-docker-test-missing-context' };

    await expect(
      runDocker(['version', '--format', '{{json .Server.Os}}'], { host, env }),
    ).resolves.toMatchObject({ exitCode: 0 });
    await expect(
      runDocker(['version', '--format', '{{json .Server.Os}}'], { env }),
    ).resolves.not.toMatchObject({ exitCode: 0 });
  });

  test('runs in the working directory it is given', async () => {
    const result = await runDocker(['compose', 'config', '--services'], {
      host,
      cwd: await (async () => {
        const project = join(directory, 'project');
        await mkdir(project, { recursive: true });
        await writeFile(join(project, 'compose.yaml'), 'services:\n  probe:\n    image: busybox\n');
        return project;
      })(),
    });

    expect(result).toMatchObject({ exitCode: 0, stdout: 'probe\n' });
  });

  test('stops the command when its signal aborts, rejecting with the reason', async () => {
    const reason = new Error('the caller stopped waiting');

    await expect(runDocker(['version'], { host, signal: AbortSignal.abort(reason) })).rejects.toBe(
      reason,
    );
  });

  test.skipIf(IS_WINDOWS)('throws DOCKER_NOT_FOUND when docker is not on the PATH', async () => {
    const empty = join(directory, 'empty');
    await mkdir(empty, { recursive: true });

    await expectToRejectCode(
      runDocker(['version'], { env: { PATH: empty } }),
      ERRORS.DOCKER_NOT_FOUND,
    );
  });

  test.skipIf(IS_WINDOWS)(
    "passes jg-process's start failure through for any other reason",
    async () => {
      const bin = join(directory, 'not-executable');
      await mkdir(bin, { recursive: true });
      await writeFile(join(bin, 'docker'), '#!/bin/sh\n', { mode: 0o644 });

      let error: unknown;
      try {
        await runDocker(['version'], { env: { PATH: bin } });
      } catch (caught) {
        error = caught;
      }

      expect(getErrorCode(error)).toBe(PROCESS_ERRORS.PROCESS_START_FAILED);
    },
  );

  test.skipIf(IS_WINDOWS)('passes the arguments without a shell, after --host', async () => {
    const bin = join(directory, 'echo-bin');
    await mkdir(bin, { recursive: true });
    await writeFile(join(bin, 'docker'), '#!/bin/sh\nprintf "%s|" "$@"\n', { mode: 0o755 });

    const result = await runDocker(['ps', '--filter', 'name=$(touch x); *'], {
      host: 'unix:///var/run/docker.sock',
      env: { PATH: bin },
    });

    expect(result.stdout).toBe(
      '--host|unix:///var/run/docker.sock|ps|--filter|name=$(touch x); *|',
    );
  });

  test.skipIf(IS_WINDOWS)('passes its timeout to jg-process', async () => {
    const bin = await writeFakeDocker(join(directory, 'slow'));
    await writeFile(join(bin, 'docker'), '#!/bin/sh\nsleep 5\n', { mode: 0o755 });

    await expectToRejectCode(
      runDocker(['version'], {
        env: { PATH: `${bin}${delimiter}${process.env['PATH'] ?? ''}` },
        timeoutSeconds: 0.5,
      }),
      PROCESS_ERRORS.PROCESS_TIMED_OUT,
    );
  });

  test.each([
    ['arguments that are not an array', 'version', {}],
    ['an argument with a null character', ['version\0'], {}],
    ['an empty host', ['version'], { host: '' }],
    ['a host that reads as an option', ['version'], { host: '--tls' }],
    ['an empty working directory', ['version'], { cwd: '' }],
    [
      'a working directory that does not exist',
      ['version'],
      { cwd: '/jg-local-docker-test/missing' },
    ],
  ])('rejects %s', async (_description, args, options) => {
    await expectToRejectCode(runDocker(args as string[], options), ERRORS.DOCKER_INVALID_ARGUMENT);
  });
});
