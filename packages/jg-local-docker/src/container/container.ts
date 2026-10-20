import { Exception, getErrorCode } from 'jg-exception';
import type { IProcessResult } from 'jg-process';

import {
  type IContainerInspection,
  inspectContainer,
  NOT_FOUND_PATTERN,
} from '../inspect/index.js';
import { DEFAULT_DOCKER_TIMEOUT_SECONDS, runDocker } from '../run-docker/index.js';
import { ERRORS, readSuccessfulOutput } from '../shared/index.js';
import { STOP_TIMEOUT_SECONDS } from './constants.js';
import type { IRemoveContainerOptions, IStartContainerOptions } from './types.js';
import { buildCreateArgs, readContainerId } from './utilities.js';
import {
  assertHost,
  assertLoopbackPorts,
  assertNameAndLabels,
  assertOwnership,
} from './validations.js';

/**
 * Builds the DOCKER_COMMAND_FAILED exception for a removal that left the container in place.
 * @param containerId The container's ID.
 * @param cause The error that made the removal necessary, if any.
 * @param removalErrorCode The code of the error the removal itself threw, if any.
 * @returns The exception.
 */
const removalFailed = (
  containerId: string,
  cause?: unknown,
  removalErrorCode: string | null = null,
): Exception =>
  new Exception('The docker command failed.', {
    code: ERRORS.DOCKER_COMMAND_FAILED,
    data: { subcommand: 'rm', containerId, removalErrorCode },
    cause,
  });

/**
 * Starts a container `docker create` made, then checks it's the one the options describe and that
 * its ports are loopback-only.
 * @param containerId The container's ID, from `docker create`.
 * @param options startContainer's options.
 * @returns A promise that resolves to the container.
 * @throws
 * - DOCKER_COMMAND_FAILED: The docker command failed.
 * - DOCKER_CONTAINER_NOT_FOUND: The container doesn't exist.
 * - DOCKER_CONTAINER_NOT_OWNED: The container isn't the one its name and labels describe.
 * - DOCKER_PORTS_NOT_LOOPBACK: The container's ports aren't each published once on 127.0.0.1.
 * - DOCKER_OUTPUT_INVALID: Docker's output isn't in the expected format.
 */
export const startCreatedContainer = async (
  containerId: string,
  {
    host,
    name,
    labels,
    ports,
    env,
    timeoutSeconds = DEFAULT_DOCKER_TIMEOUT_SECONDS,
    signal,
  }: IStartContainerOptions,
): Promise<IContainerInspection> => {
  readSuccessfulOutput(
    await runDocker(['start', containerId], { host, env, timeoutSeconds, signal }),
    'start',
  );
  const inspection = await inspectContainer(containerId, {
    host,
    labels: Object.keys(labels),
    env,
    timeoutSeconds,
    signal,
  });
  if (inspection.id !== containerId) {
    throw new Exception("The container isn't the one its name and labels describe.", {
      code: ERRORS.DOCKER_CONTAINER_NOT_OWNED,
      data: { name },
    });
  }
  assertOwnership(inspection, name, labels);
  assertLoopbackPorts(inspection, ports);
  return inspection;
};

/**
 * Creates a container, starts it, and reads it back with inspectContainer: it must be the one
 * created, with the name and every label asked for, and publish each port exactly once, on a
 * random port of 127.0.0.1, and nothing else. Any failure after the creation, an abort included,
 * removes the container by its ID before the error is thrown. Labels such as a random nonce are
 * what removeContainer later checks, so the container can't be confused with another of the same
 * name.
 * @param options The endpoint, the name, the labels, the image, the ports, the extra arguments,
 * the command, and the limits.
 * @returns A promise that resolves to the running container.
 * @example
 * import { randomUUID } from 'node:crypto';
 * import { removeContainer, resolveLocalDockerHost, startContainer } from 'jg-local-docker';
 *
 * const host = await resolveLocalDockerHost();
 * const labels = { 'app.test.nonce': randomUUID() };
 * const redis = await startContainer({ host, name: 'app-test-redis', labels, image: 'redis:8.6.2-alpine', ports: [6379] });
 * const port = redis.ports[0]?.hostPort; // a random port on 127.0.0.1
 * await removeContainer('app-test-redis', { host, labels });
 * @throws
 * - DOCKER_INVALID_ARGUMENT: An argument isn't valid.
 * - DOCKER_COMMAND_FAILED: The docker command failed.
 * - DOCKER_CONTAINER_NOT_FOUND: The container doesn't exist.
 * - DOCKER_CONTAINER_NOT_OWNED: The container isn't the one its name and labels describe.
 * - DOCKER_PORTS_NOT_LOOPBACK: The container's ports aren't each published once on 127.0.0.1.
 * - DOCKER_OUTPUT_INVALID: Docker's output isn't in the expected format.
 * - DOCKER_NOT_FOUND: Docker isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const startContainer = async (
  options: IStartContainerOptions,
): Promise<IContainerInspection> => {
  const args = buildCreateArgs(options);
  const { host, env, timeoutSeconds = DEFAULT_DOCKER_TIMEOUT_SECONDS, signal } = options;
  const containerId = readContainerId(
    readSuccessfulOutput(await runDocker(args, { host, env, timeoutSeconds, signal }), 'create'),
  );
  try {
    return await startCreatedContainer(containerId, options);
  } catch (error) {
    // without the signal, so an abort still removes what it created
    let removal: IProcessResult;
    try {
      removal = await runDocker(['rm', '--force', '--volumes', containerId], {
        host,
        env,
        timeoutSeconds,
      });
    } catch (removalError) {
      throw removalFailed(containerId, error, getErrorCode(removalError));
    }
    if (removal.exitCode !== 0 && !NOT_FOUND_PATTERN.test(removal.stderr)) {
      throw removalFailed(containerId, error, null);
    }
    throw error;
  }
};

/**
 * Runs a docker command on a container, treating a container that's already gone as success.
 * @param args The command's arguments.
 * @param subcommand The subcommand, for the error.
 * @param options The endpoint and the limits.
 * @returns A promise that resolves once the command succeeded or found nothing.
 * @throws
 * - DOCKER_COMMAND_FAILED: The docker command failed.
 */
const runOnContainer = async (
  args: string[],
  subcommand: string,
  options: Pick<IRemoveContainerOptions, 'host' | 'env' | 'timeoutSeconds' | 'signal'>,
): Promise<void> => {
  const result = await runDocker(args, options);
  if (result.exitCode !== 0 && !NOT_FOUND_PATTERN.test(result.stderr)) {
    readSuccessfulOutput(result, subcommand);
  }
};

/**
 * Removes a container only when it has the exact name and every label given, such as one
 * startContainer started: it stops it, removes it by ID with its anonymous volumes, and confirms
 * it's gone. A container with that name but other labels, or found by an ID that starts with the
 * name, is refused, so a name another program reuses is never removed.
 * @param name The container's name.
 * @param options The endpoint, the labels, and the limits.
 * @returns A promise that resolves to true when it removed the container, and false when there
 * was none.
 * @example
 * import { removeContainer, resolveLocalDockerHost } from 'jg-local-docker';
 *
 * const host = await resolveLocalDockerHost();
 * await removeContainer('app-test-redis', { host, labels: { 'app.test.nonce': 'a0b1c2' } });
 * @throws
 * - DOCKER_INVALID_ARGUMENT: An argument isn't valid.
 * - DOCKER_CONTAINER_NOT_OWNED: The container isn't the one its name and labels describe.
 * - DOCKER_COMMAND_FAILED: The docker command failed.
 * - DOCKER_OUTPUT_INVALID: Docker's output isn't in the expected format.
 * - DOCKER_NOT_FOUND: Docker isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const removeContainer = async (
  name: string,
  {
    host,
    labels,
    env,
    timeoutSeconds = DEFAULT_DOCKER_TIMEOUT_SECONDS,
    signal,
  }: IRemoveContainerOptions,
): Promise<boolean> => {
  assertHost(host);
  assertNameAndLabels(name, labels);
  const limits = { host, env, timeoutSeconds, signal };
  let inspection: IContainerInspection;
  try {
    inspection = await inspectContainer(name, { ...limits, labels: Object.keys(labels) });
  } catch (error) {
    if (getErrorCode(error) === ERRORS.DOCKER_CONTAINER_NOT_FOUND) {
      return false;
    }
    throw error;
  }
  assertOwnership(inspection, name, labels);
  if (inspection.isRunning) {
    await runOnContainer(
      ['stop', '--time', String(STOP_TIMEOUT_SECONDS), inspection.id],
      'stop',
      limits,
    );
  }
  await runOnContainer(['rm', '--force', '--volumes', inspection.id], 'rm', limits);
  try {
    await inspectContainer(inspection.id, limits);
  } catch (error) {
    if (getErrorCode(error) === ERRORS.DOCKER_CONTAINER_NOT_FOUND) {
      return true;
    }
    throw error;
  }
  throw removalFailed(inspection.id);
};
