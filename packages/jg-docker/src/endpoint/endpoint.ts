import { Exception } from 'jg-exception';

import { DEFAULT_DOCKER_TIMEOUT_SECONDS, runDocker } from '../run-docker/index.js';
import { ERRORS, invalidOutput, readSuccessfulOutput } from '../shared/index.js';
import { LOCAL_ENDPOINT_PATTERN } from './constants.js';
import type { IResolveLocalDockerHostOptions } from './types.js';

/**
 * Builds the exception for an endpoint that isn't on this machine. The endpoint stays out, since
 * an `ssh://` one can name a user.
 * @param source Where the endpoint came from.
 * @returns The DOCKER_ENDPOINT_NOT_LOCAL exception.
 */
const endpointNotLocal = (source: 'DOCKER_HOST' | 'context'): Exception =>
  new Exception("The Docker endpoint isn't on this machine.", {
    code: ERRORS.DOCKER_ENDPOINT_NOT_LOCAL,
    data: { source },
  });

/**
 * Checks whether a Docker endpoint is on this machine: a Unix socket (`unix://`) or a Windows
 * named pipe (`npipe://`). A `tcp://` or an `ssh://` endpoint isn't, even on 127.0.0.1, because a
 * forwarded port or a tunnel can reach another machine.
 * @param host The endpoint, such as DOCKER_HOST's value.
 * @returns Whether it's local.
 * @example
 * import { isLocalDockerEndpoint } from 'jg-docker';
 *
 * isLocalDockerEndpoint('unix:///var/run/docker.sock'); // true
 * isLocalDockerEndpoint('npipe:////./pipe/docker_engine'); // true
 * isLocalDockerEndpoint('tcp://127.0.0.1:2375'); // false
 */
export const isLocalDockerEndpoint = (host: unknown): host is string =>
  typeof host === 'string' && LOCAL_ENDPOINT_PATTERN.test(host);

/**
 * Resolves the Docker endpoint the docker command would use, and checks that it's on this
 * machine: DOCKER_HOST, when it's set, and the current context's endpoint, which must match it.
 * Pass the result as `host` to every later command, so a context switch can't redirect them.
 * @param options The environment to read and run docker with, and the limits.
 * @returns A promise that resolves to the endpoint, such as `unix:///var/run/docker.sock`.
 * @example
 * import { resolveLocalDockerHost, runDocker } from 'jg-docker';
 *
 * const host = await resolveLocalDockerHost();
 * await runDocker(['compose', 'up', '--detach', '--wait'], { host, cwd: '/srv/app', timeoutSeconds: 300 });
 * @throws
 * - DOCKER_ENDPOINT_NOT_LOCAL: The Docker endpoint isn't on this machine.
 * - DOCKER_COMMAND_FAILED: The docker command failed.
 * - DOCKER_OUTPUT_INVALID: Docker's output isn't in the expected format.
 * - DOCKER_NOT_FOUND: Docker isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const resolveLocalDockerHost = async ({
  env = process.env,
  timeoutSeconds = DEFAULT_DOCKER_TIMEOUT_SECONDS,
  signal,
}: IResolveLocalDockerHostOptions = {}): Promise<string> => {
  // Docker treats an empty DOCKER_HOST as unset
  const dockerHost = env['DOCKER_HOST'] === '' ? undefined : env['DOCKER_HOST'];
  if (dockerHost !== undefined && !isLocalDockerEndpoint(dockerHost)) {
    throw endpointNotLocal('DOCKER_HOST');
  }
  const output = readSuccessfulOutput(
    await runDocker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], {
      env,
      timeoutSeconds,
      signal,
    }),
    'context inspect',
  );
  let contextHost: unknown;
  try {
    contextHost = JSON.parse(output);
  } catch {
    throw invalidOutput('context inspect');
  }
  if (typeof contextHost !== 'string') {
    throw invalidOutput('context inspect');
  }
  if (
    !isLocalDockerEndpoint(contextHost) ||
    (dockerHost !== undefined && contextHost !== dockerHost)
  ) {
    throw endpointNotLocal('context');
  }
  return contextHost;
};
