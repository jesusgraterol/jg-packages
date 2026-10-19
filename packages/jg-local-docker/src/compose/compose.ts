import { DEFAULT_DOCKER_TIMEOUT_SECONDS, runDocker } from '../run-docker/index.js';
import { invalidArgument, isArgumentValid, readSuccessfulOutput } from '../shared/index.js';
import { PROJECT_NAME_PATTERN, SERVICE_NAME_PATTERN } from './constants.js';
import type { IComposeService, IListComposeServicesOptions } from './types.js';
import { parseComposePs } from './utilities.js';

/**
 * Checks whether every value is a service's or a profile's name.
 * @param names The values.
 * @returns Whether they are.
 */
const areServiceNames = (names: unknown): names is string[] =>
  Array.isArray(names) &&
  names.every((name: unknown) => typeof name === 'string' && SERVICE_NAME_PATTERN.test(name));

/**
 * Lists a Compose project's containers with `docker compose ps --format json`, at the endpoint
 * `host` names, stopped ones included unless `all` is false.
 * @param options The project's directory, the endpoint, which services, and the limits.
 * @returns A promise that resolves to the services, in Compose's order.
 * @example
 * import { listComposeServices, resolveLocalDockerHost } from 'jg-local-docker';
 *
 * const host = await resolveLocalDockerHost();
 * const services = await listComposeServices({ cwd: '/srv/app', host, services: ['db', 'cache'] });
 * const isReady = services.every(({ state, health }) => state === 'running' && health !== 'unhealthy');
 * @throws
 * - DOCKER_INVALID_ARGUMENT: An argument isn't valid.
 * - DOCKER_COMMAND_FAILED: The docker command failed.
 * - DOCKER_OUTPUT_INVALID: Docker's output isn't in the expected format.
 * - DOCKER_NOT_FOUND: Docker isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const listComposeServices = async ({
  cwd,
  host,
  projectName,
  profiles = [],
  services = [],
  all = true,
  env,
  timeoutSeconds = DEFAULT_DOCKER_TIMEOUT_SECONDS,
  signal,
}: IListComposeServicesOptions): Promise<IComposeService[]> => {
  if (!isArgumentValid(host)) {
    throw invalidArgument('host');
  }
  if (
    projectName !== undefined &&
    !(typeof projectName === 'string' && PROJECT_NAME_PATTERN.test(projectName))
  ) {
    throw invalidArgument('projectName');
  }
  if (!areServiceNames(profiles)) {
    throw invalidArgument('profiles');
  }
  if (!areServiceNames(services)) {
    throw invalidArgument('services');
  }
  const result = await runDocker(
    [
      'compose',
      ...(projectName === undefined ? [] : ['--project-name', projectName]),
      ...profiles.flatMap((profile) => ['--profile', profile]),
      'ps',
      ...(all ? ['--all'] : []),
      '--format',
      'json',
      '--no-trunc',
      ...services,
    ],
    { host, cwd, env, timeoutSeconds, signal },
  );
  return parseComposePs(readSuccessfulOutput(result, 'compose ps'));
};
