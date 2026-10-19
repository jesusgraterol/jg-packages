import { Exception } from 'jg-exception';

import { DEFAULT_DOCKER_TIMEOUT_SECONDS, runDocker } from '../run-docker/index.js';
import { ERRORS, invalidArgument, isArgumentValid, readSuccessfulOutput } from '../shared/index.js';
import { INSPECT_TEMPLATE, LABEL_KEY_PATTERN, NOT_FOUND_PATTERN } from './constants.js';
import type { IContainerInspection, IInspectContainerOptions } from './types.js';
import { parseInspection } from './utilities.js';

/**
 * Reads a container's ID, name, state, health, the labels asked for, and its published ports, with
 * `docker inspect` and a fixed template that never reads its environment, command, mounts, or
 * logs.
 * @param ref The container's name or ID.
 * @param options The endpoint, the label keys, and the limits.
 * @returns A promise that resolves to the inspection.
 * @example
 * import { inspectContainer, resolveLocalDockerHost } from 'jg-local-docker';
 *
 * const host = await resolveLocalDockerHost();
 * const redis = await inspectContainer('app-cache-1', { host, labels: ['com.docker.compose.project'] });
 * const isLoopbackOnly = redis.ports.every(({ hostIp }) => hostIp === '127.0.0.1');
 * @throws
 * - DOCKER_INVALID_ARGUMENT: An argument isn't valid.
 * - DOCKER_CONTAINER_NOT_FOUND: The container doesn't exist.
 * - DOCKER_COMMAND_FAILED: The docker command failed.
 * - DOCKER_OUTPUT_INVALID: Docker's output isn't in the expected format.
 * - DOCKER_NOT_FOUND: Docker isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const inspectContainer = async (
  ref: string,
  {
    host,
    labels = [],
    env,
    timeoutSeconds = DEFAULT_DOCKER_TIMEOUT_SECONDS,
    signal,
  }: IInspectContainerOptions,
): Promise<IContainerInspection> => {
  if (!isArgumentValid(ref)) {
    throw invalidArgument('ref');
  }
  if (!isArgumentValid(host)) {
    throw invalidArgument('host');
  }
  if (
    !Array.isArray(labels) ||
    !labels.every((key: unknown) => typeof key === 'string' && LABEL_KEY_PATTERN.test(key))
  ) {
    throw invalidArgument('labels');
  }
  const result = await runDocker(
    ['inspect', '--type', 'container', '--format', INSPECT_TEMPLATE, ref],
    { host, env, timeoutSeconds, signal },
  );
  if (result.exitCode !== 0 && NOT_FOUND_PATTERN.test(result.stderr)) {
    throw new Exception("The container doesn't exist.", {
      code: ERRORS.DOCKER_CONTAINER_NOT_FOUND,
    });
  }
  return parseInspection(readSuccessfulOutput(result, 'inspect'), labels);
};
