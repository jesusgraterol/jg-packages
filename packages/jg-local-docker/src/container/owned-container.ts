import { type ChildProcess, fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Exception } from 'jg-exception';

import { DEFAULT_DOCKER_TIMEOUT_SECONDS } from '../run-docker/index.js';
import { ERRORS } from '../shared/index.js';
import { startCreatedContainer } from './container.js';
import type { IOwnedContainer, IStartContainerOptions } from './types.js';
import { buildCreateArgs } from './utilities.js';

// the owner process's script, next to this module in the source and in the build
const OWNER_SCRIPT = fileURLToPath(new URL('./owner.js', import.meta.url));

/**
 * Builds the DOCKER_OWNER_FAILED exception.
 * @param cause What went wrong, if anything was thrown.
 * @returns The exception.
 */
const ownerFailed = (cause?: unknown): Exception =>
  new Exception("The container's owner process failed.", {
    code: ERRORS.DOCKER_OWNER_FAILED,
    cause,
  });

/**
 * Waits for the owner process to report the container it created.
 * @param owner The owner process.
 * @param signal Stops the wait when it aborts.
 * @returns A promise that resolves to the container's ID.
 * @throws
 * - DOCKER_COMMAND_FAILED: The docker command failed.
 * - DOCKER_OWNER_FAILED: The container's owner process failed.
 * - The signal's reason when the signal aborts.
 */
const waitForCreation = (owner: ChildProcess, signal: AbortSignal | undefined): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const settle = (outcome: () => void): void => {
      owner.off('message', onMessage);
      owner.off('exit', onExit);
      owner.off('error', onExit);
      signal?.removeEventListener('abort', onAbort);
      outcome();
    };
    // the owner sends one message: the container's ID, or that the creation failed
    const onMessage = (message: unknown): void => {
      // Object gives a message that isn't an object no fields
      const report = Object(message) as Record<string, unknown>;
      const id = report['type'] === 'created' ? report['id'] : undefined;
      if (typeof id === 'string') {
        settle(() => resolve(id));
        return;
      }
      const exitCode = typeof report['exitCode'] === 'number' ? report['exitCode'] : null;
      settle(() =>
        reject(
          new Exception('The docker command failed.', {
            code: ERRORS.DOCKER_COMMAND_FAILED,
            data: { subcommand: 'create', exitCode },
          }),
        ),
      );
    };
    const onExit = (error?: unknown): void => {
      settle(() => reject(ownerFailed(error)));
    };
    const onAbort = (): void => {
      settle(() => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rejects with the signal's reason, as native APIs do
        reject(signal?.reason);
      });
    };
    owner.on('message', onMessage);
    owner.once('exit', onExit);
    owner.once('error', onExit);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Starts a container as startContainer does, through an owner process that removes it when this
 * process disconnects from it: when `release` is called, when this process exits or crashes, or
 * when it's interrupted. The owner creates the container itself, so it knows its ID from the first
 * moment, and it handles SIGINT and SIGTERM, which Ctrl+C sends the whole process group, by
 * removing the container before it exits. Use it for a container that must not outlive a test
 * run, such as in a test runner's global setup, which may exit at once on Ctrl+C.
 * @param options The endpoint, the name, the labels, the image, the ports, the extra arguments,
 * the command, and the limits, as startContainer takes them.
 * @returns A promise that resolves to the running container, and `release`, which removes it and
 * waits for the owner to exit.
 * @example
 * import { randomUUID } from 'node:crypto';
 * import { resolveLocalDockerHost, startOwnedContainer } from 'jg-local-docker';
 *
 * const host = await resolveLocalDockerHost();
 * const { container, release } = await startOwnedContainer({
 *   host,
 *   name: `app-test-redis-${randomUUID()}`,
 *   labels: { 'app.test.nonce': randomUUID() },
 *   image: 'redis:8.6.2-alpine',
 *   ports: [6379],
 * });
 * // ... the tests, against 127.0.0.1 and container.ports[0]?.hostPort
 * await release();
 * @throws
 * - DOCKER_INVALID_ARGUMENT: An argument isn't valid.
 * - DOCKER_COMMAND_FAILED: The docker command failed.
 * - DOCKER_CONTAINER_NOT_FOUND: The container doesn't exist.
 * - DOCKER_CONTAINER_NOT_OWNED: The container isn't the one its name and labels describe.
 * - DOCKER_PORTS_NOT_LOOPBACK: The container's ports aren't each published once on 127.0.0.1.
 * - DOCKER_OUTPUT_INVALID: Docker's output isn't in the expected format.
 * - DOCKER_OWNER_FAILED: The container's owner process failed.
 * - DOCKER_NOT_FOUND: Docker isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const startOwnedContainer = async (
  options: IStartContainerOptions,
): Promise<IOwnedContainer> => {
  const args = buildCreateArgs(options);
  const { host, env, timeoutSeconds = DEFAULT_DOCKER_TIMEOUT_SECONDS, signal } = options;
  signal?.throwIfAborted();
  const owner = fork(OWNER_SCRIPT, [], {
    execArgv: [],
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    ...(env === undefined ? {} : { env }),
  });
  // an error, such as one sending to the owner, ends it too, never cleanly
  const hasExitedCleanly = new Promise<boolean>((resolve) => {
    const onEnd = (code: unknown, exitSignal?: unknown): void => {
      resolve(code === 0 && exitSignal === null);
    };
    owner.once('exit', onEnd);
    owner.once('error', onEnd);
  });
  let releasing: Promise<void> | undefined;
  const release = (): Promise<void> => {
    releasing ??= (async () => {
      if (owner.connected) {
        owner.disconnect();
      }
      if (!(await hasExitedCleanly)) {
        throw ownerFailed();
      }
    })();
    return releasing;
  };

  try {
    owner.send({ type: 'create', host, args, timeoutSeconds });
    const containerId = await waitForCreation(owner, signal);
    return { container: await startCreatedContainer(containerId, options), release };
  } catch (error) {
    try {
      await release();
    } catch (releaseError) {
      throw ownerFailed([error, releaseError]);
    }
    throw error;
  }
};
