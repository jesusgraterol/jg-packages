import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runDocker } from '../run-docker/index.js';

// the image every test container runs, already used by jg-redis's tests
export const TEST_IMAGE = 'redis:8.6.2-alpine';

// the seconds a test may wait for Docker to pull the image and start containers
export const DOCKER_SETUP_TIMEOUT_SECONDS = 180;

/**
 * Builds a name for a resource a test creates, which the tests' cleanup can tell apart from any
 * other container or project on the machine.
 * @returns A name such as `jg-docker-test-1a2b3c4d`.
 */
export const createTestName = (): string => `jg-docker-test-${randomBytes(4).toString('hex')}`;

/**
 * Creates a temporary directory, by its real path, since macOS keeps the temporary directory
 * behind a symbolic link.
 * @param prefix What the directory's name starts with.
 * @returns A promise that resolves to the directory.
 */
export const createTemporaryDirectory = async (prefix: string): Promise<string> =>
  realpathSync(await mkdtemp(join(tmpdir(), `jg-docker-${prefix}-`)));

/**
 * Runs docker for a test's setup or cleanup, failing on a non-zero exit.
 * @param host The endpoint.
 * @param args The command's arguments.
 * @param cwd The directory docker runs in.
 * @returns A promise that resolves to the trimmed stdout.
 */
export const docker = async (host: string, args: string[], cwd?: string): Promise<string> => {
  const result = await runDocker(args, {
    host,
    ...(cwd === undefined ? {} : { cwd }),
    timeoutSeconds: DOCKER_SETUP_TIMEOUT_SECONDS,
    maxOutputBytes: 1_048_576,
  });
  if (result.exitCode !== 0) {
    throw new Error(`docker ${args.join(' ')} exited with ${result.exitCode}: ${result.stderr}`);
  }
  return result.stdout.trim();
};

/**
 * Writes a fake docker program that prints JG_DOCKER_FAKE_OUTPUT and exits with
 * JG_DOCKER_FAKE_EXIT, 0 by default, for output the real one never writes.
 * @param directory The directory whose bin directory it's written in.
 * @returns A promise that resolves to the bin directory, for PATH.
 */
export const writeFakeDocker = async (directory: string): Promise<string> => {
  const bin = join(directory, 'bin');
  await mkdir(bin, { recursive: true });
  await writeFile(
    join(bin, 'docker'),
    '#!/bin/sh\nprintf "%s" "$JG_DOCKER_FAKE_OUTPUT"\nexit "${JG_DOCKER_FAKE_EXIT:-0}"\n',
    { mode: 0o755 },
  );
  return bin;
};
