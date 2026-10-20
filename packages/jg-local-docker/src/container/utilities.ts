import { invalidArgument, invalidOutput, isArgumentValid } from '../shared/index.js';
import { CONTAINER_ID_PATTERN, LOOPBACK_ADDRESS } from './constants.js';
import type { IStartContainerOptions } from './types.js';
import { assertHost, assertNameAndLabels } from './validations.js';

/**
 * Checks whether a value is a list of strings without a null character.
 * @param value The value.
 * @returns Whether it is.
 */
const isArgumentList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.every((item: unknown) => typeof item === 'string' && !item.includes('\0'));

/**
 * Checks startContainer's options and builds its `docker create` arguments: the name, each label,
 * each port published on a random port of 127.0.0.1, the extra arguments, the image, and the
 * command.
 * @param options The options.
 * @returns The arguments, starting with `create`.
 * @throws
 * - DOCKER_INVALID_ARGUMENT: An argument isn't valid.
 */
export const buildCreateArgs = ({
  host,
  name,
  labels,
  image,
  ports,
  createArgs = [],
  command = [],
}: IStartContainerOptions): string[] => {
  assertHost(host);
  assertNameAndLabels(name, labels);
  if (!isArgumentValid(image)) {
    throw invalidArgument('image');
  }
  if (
    !Array.isArray(ports) ||
    !ports.every(
      (port: unknown) => Number.isInteger(port) && Number(port) > 0 && Number(port) <= 65_535,
    ) ||
    new Set(ports).size !== ports.length
  ) {
    throw invalidArgument('ports');
  }
  if (!isArgumentList(createArgs)) {
    throw invalidArgument('createArgs');
  }
  if (!isArgumentList(command)) {
    throw invalidArgument('command');
  }
  return [
    'create',
    '--name',
    name,
    ...Object.entries(labels).flatMap(([key, value]) => ['--label', `${key}=${value}`]),
    ...ports.flatMap((port) => ['--publish', `${LOOPBACK_ADDRESS}::${String(port)}`]),
    ...createArgs,
    image,
    ...command,
  ];
};

/**
 * Reads the container ID `docker create` writes.
 * @param stdout The command's stdout.
 * @returns The ID.
 * @throws
 * - DOCKER_OUTPUT_INVALID: Docker's output isn't in the expected format.
 */
export const readContainerId = (stdout: string): string => {
  const id = stdout.trim();
  if (!CONTAINER_ID_PATTERN.test(id)) {
    throw invalidOutput('create');
  }
  return id;
};
