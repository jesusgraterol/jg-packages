/*
 * The owner process startOwnedContainer forks: it creates one container when its parent asks, and
 * removes it, with its anonymous volumes, when the parent disconnects, exits, or is interrupted,
 * then exits with 0 once the container is confirmed gone, or 1 when it isn't. It handles SIGINT and
 * SIGTERM itself, so a test run stopped with Ctrl+C, which signals the whole process group, still
 * removes the container. It's plain JavaScript, so it runs from the package's source as from its
 * build, and it only removes the container whose ID its own `docker create` printed.
 */
import { runProcess } from 'jg-process';

// a full container ID, as `docker create` writes it
const CONTAINER_ID_PATTERN = /^[0-9a-f]{64}$/;

// what Docker writes to stderr for a container that doesn't exist
const NOT_FOUND_PATTERN = /No such (?:container|object)/i;

// the most bytes of output each docker command may write
const MAX_OUTPUT_BYTES = 65_536;

// the endpoint and the limit the parent's request set, for the removal
let request;

// the ID of the container created, or undefined when none was
let creation = Promise.resolve(undefined);

// the removal, once it started
let closing;

/**
 * Sends a message to the parent while it's connected.
 * @param {object} message The message.
 */
const send = (message) => {
  if (process.connected) {
    process.send(message);
  }
};

/**
 * Runs a docker command on the parent's endpoint.
 * @param {string[]} args The command's arguments.
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>} The result.
 */
const docker = (args) =>
  runProcess({
    command: 'docker',
    args: ['--host', request.host, ...args],
    timeoutSeconds: request.timeoutSeconds,
    maxOutputBytes: MAX_OUTPUT_BYTES,
  });

/**
 * Creates the container, and tells the parent its ID or that the creation failed.
 * @param {string[]} args The `docker create` arguments.
 * @returns {Promise<string | undefined>} The container's ID, or undefined when none was created.
 */
const create = async (args) => {
  try {
    const { exitCode, stdout } = await docker(args);
    const id = stdout.trim();
    if (exitCode === 0 && CONTAINER_ID_PATTERN.test(id)) {
      send({ type: 'created', id });
      return id;
    }
    send({ type: 'create-failed', exitCode });
  } catch {
    send({ type: 'create-failed', exitCode: null });
  }
  return undefined;
};

/**
 * Removes the container once its creation settles, confirms it's gone, and lets the process exit.
 * @returns {Promise<void>} The removal.
 */
const close = () => {
  closing ??= (async () => {
    const id = await creation;
    let isRemoved = true;
    if (id !== undefined) {
      try {
        const removal = await docker(['rm', '--force', '--volumes', id]);
        const check = await docker(['inspect', '--type', 'container', '--format', '{{.Id}}', id]);
        isRemoved =
          (removal.exitCode === 0 || NOT_FOUND_PATTERN.test(removal.stderr)) &&
          check.exitCode !== 0 &&
          NOT_FOUND_PATTERN.test(check.stderr);
      } catch {
        isRemoved = false;
      }
    }
    process.exitCode = isRemoved ? 0 : 1;
    if (process.connected) {
      process.disconnect();
    }
  })();
  return closing;
};

process.on('message', (message) => {
  if (request === undefined && closing === undefined && message?.type === 'create') {
    request = { host: message.host, timeoutSeconds: message.timeoutSeconds };
    creation = create(message.args);
  }
});
process.once('disconnect', () => void close());
// every signal is handled, so a second Ctrl+C can't stop the removal partway
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());
