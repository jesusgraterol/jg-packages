import { lstat, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { extractMessage, getErrorCode } from 'jg-exception';
import { resolvePackageManagerCommand, runProcess } from 'jg-process';

import { packageCheckError } from '../errors.js';

import type { IPackedConsumer, IPackedConsumerOptions } from './types.js';

/**
 * Refuses positional values that could be parsed as package-manager switches or directories.
 * @param options The requested consumer.
 */
const validateArtifacts = async (options: IPackedConsumerOptions): Promise<void> => {
  if (options.packageManager !== 'npm' && options.packageManager !== 'pnpm')
    throw new Error('The package manager must be npm or pnpm.');
  if (options.tarballs.length === 0) throw new Error('At least one tarball is required.');
  for (const path of options.tarballs) {
    if (!isAbsolute(path) || !path.endsWith('.tgz') || !(await lstat(path)).isFile())
      throw new Error('Each tarball must be an absolute path to a regular .tgz file.');
  }
  for (const specifier of options.additionalPackages ?? []) {
    if (specifier === '' || specifier.startsWith('-'))
      throw new Error('Additional package specifiers cannot be empty or start with a dash.');
  }
};

/**
 * Prepares the isolated project and runs the requested package manager without lifecycle scripts.
 * @param directory The owned temporary directory.
 * @param options The requested installation.
 * @returns The installed consumer.
 */
const install = async (
  directory: string,
  options: IPackedConsumerOptions,
): Promise<IPackedConsumer> => {
  const { packageManager, signal, offline, tarballs, additionalPackages, prepare } = options;
  const consumer: IPackedConsumer = {
    directory: await realpath(directory),
    env: { ...(options.env ?? process.env) },
    ...(signal === undefined ? {} : { signal }),
  };
  await writeFile(
    join(consumer.directory, 'package.json'),
    JSON.stringify({ name: 'jg-packed-consumer', type: 'module', private: true }),
    { flag: 'wx' },
  );
  await prepare?.(consumer);
  const argumentsForManager =
    packageManager === 'npm'
      ? ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock']
      : ['add', '--ignore-scripts', '--save-exact'];
  const command = resolvePackageManagerCommand(
    [
      ...argumentsForManager,
      ...(offline ? ['--offline'] : []),
      ...tarballs,
      ...(additionalPackages ?? []),
    ],
    { packageManager, env: consumer.env, cwd: consumer.directory },
  );
  const result = await runProcess({
    ...command,
    cwd: consumer.directory,
    env: consumer.env,
    ...(signal === undefined ? {} : { signal }),
    timeoutSeconds: options.installTimeoutSeconds ?? 120,
  });
  if (result.exitCode !== 0) {
    const diagnostic = (result.stderr || result.stdout).trim().slice(0, 2048);
    throw new Error(
      diagnostic || `Package installation ended with ${result.signalCode ?? result.exitCode}.`,
    );
  }
  return consumer;
};

/**
 * Removes the owned directory and checks that the path no longer exists.
 * @param directory The directory returned by mkdtemp.
 */
const removeConsumer = async (directory: string): Promise<void> => {
  await rm(directory, { recursive: true, force: true });
  try {
    await lstat(directory);
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') return;
    throw error;
  }
  throw new Error('The temporary directory still exists.');
};

/**
 * Installs absolute local tarball paths using npm or pnpm with lifecycle scripts disabled. Creates
 * a fresh ESM project, optionally lets the caller configure it, and removes it after the callback
 * settles. Use committed, trusted package artifacts. The callback owns its verification commands.
 * @param options Installation, optional fixture preparation, and process settings.
 * @param check The checks to run inside the installed consumer.
 * @returns The callback's result after the consumer has been removed.
 * @example
 * import { resolve } from 'node:path';
 * import { checkPackedExports, withPackedConsumer } from 'jg-package-check';
 *
 * const tarball = resolve('jg-example-1.0.0.tgz');
 * await withPackedConsumer({ packageManager: 'npm', tarballs: [tarball] }, (consumer) =>
 *   checkPackedExports(consumer, { packageName: 'jg-example', importSubpaths: ['.'] }),
 * );
 * @throws
 * - PACKED_CONSUMER_SETUP_FAILED: Unable to prepare the packed consumer.
 * - PACKED_CONSUMER_CLEANUP_FAILED: Unable to remove the packed consumer.
 */
export const withPackedConsumer = async <T>(
  options: IPackedConsumerOptions,
  check: (consumer: IPackedConsumer) => Promise<T>,
): Promise<T> => {
  let directory: string | undefined;
  let outcome: { result: T } | { error: unknown };
  try {
    let consumer: IPackedConsumer;
    try {
      options.signal?.throwIfAborted();
      await validateArtifacts(options);
      directory = await mkdtemp(join(tmpdir(), 'jg-packed-consumer-'));
      consumer = await install(directory, options);
    } catch (cause) {
      throw packageCheckError('PACKED_CONSUMER_SETUP_FAILED', cause);
    }
    outcome = { result: await check(consumer) };
  } catch (error) {
    outcome = { error };
  }
  if (directory !== undefined) {
    try {
      await removeConsumer(directory);
    } catch (cause) {
      throw packageCheckError(
        'PACKED_CONSUMER_CLEANUP_FAILED',
        'error' in outcome
          ? new AggregateError([cause, outcome.error], extractMessage(cause))
          : cause,
        directory,
      );
    }
  }
  if ('error' in outcome) throw outcome.error;
  return outcome.result;
};
