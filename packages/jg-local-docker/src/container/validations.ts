import { Exception } from 'jg-exception';

import { type IContainerInspection, LABEL_KEY_PATTERN } from '../inspect/index.js';
import { ERRORS, invalidArgument, isArgumentValid, isRecord } from '../shared/index.js';
import { CONTAINER_NAME_PATTERN, LOOPBACK_ADDRESS } from './constants.js';

/**
 * Checks a container's name and the labels that prove it's the caller's: a name Docker accepts,
 * and at least one label, each with a valid key and a value without a null character.
 * @param name The name.
 * @param labels The labels.
 * @throws
 * - DOCKER_INVALID_ARGUMENT: An argument isn't valid.
 */
export const assertNameAndLabels = (name: unknown, labels: unknown): void => {
  if (typeof name !== 'string' || !CONTAINER_NAME_PATTERN.test(name)) {
    throw invalidArgument('name');
  }
  if (
    !isRecord(labels) ||
    Object.keys(labels).length === 0 ||
    !Object.entries(labels).every(
      ([key, value]) =>
        LABEL_KEY_PATTERN.test(key) && typeof value === 'string' && !value.includes('\0'),
    )
  ) {
    throw invalidArgument('labels');
  }
};

/**
 * Checks the Docker endpoint.
 * @param host The endpoint.
 * @throws
 * - DOCKER_INVALID_ARGUMENT: An argument isn't valid.
 */
export const assertHost = (host: unknown): void => {
  if (!isArgumentValid(host)) {
    throw invalidArgument('host');
  }
};

/**
 * Checks that a container is the one its name and labels describe.
 * @param inspection The container, as inspectContainer read it.
 * @param name The name it must have.
 * @param labels The labels it must have, every one with the same value.
 * @throws
 * - DOCKER_CONTAINER_NOT_OWNED: The container isn't the one its name and labels describe.
 */
export const assertOwnership = (
  inspection: IContainerInspection,
  name: string,
  labels: Readonly<Record<string, string>>,
): void => {
  if (
    inspection.name !== name ||
    !Object.entries(labels).every(([key, value]) => inspection.labels[key] === value)
  ) {
    throw new Exception("The container isn't the one its name and labels describe.", {
      code: ERRORS.DOCKER_CONTAINER_NOT_OWNED,
      data: { name },
    });
  }
};

/**
 * Checks that a container publishes each requested port exactly once, on 127.0.0.1, and nothing
 * else, such as a port published by `createArgs`. A container that stopped publishes none.
 * @param inspection The container, as inspectContainer read it.
 * @param ports The container's TCP ports that must be published.
 * @throws
 * - DOCKER_PORTS_NOT_LOOPBACK: The container's ports aren't each published once on 127.0.0.1.
 */
export const assertLoopbackPorts = (
  inspection: IContainerInspection,
  ports: readonly number[],
): void => {
  const isEachPortPublishedOnce = ports.every(
    (port) =>
      inspection.ports.filter(
        ({ containerPort, protocol }) => containerPort === port && protocol === 'tcp',
      ).length === 1,
  );
  if (
    !isEachPortPublishedOnce ||
    inspection.ports.length !== ports.length ||
    !inspection.ports.every(({ hostIp }) => hostIp === LOOPBACK_ADDRESS)
  ) {
    throw new Exception("The container's ports aren't each published once on 127.0.0.1.", {
      code: ERRORS.DOCKER_PORTS_NOT_LOOPBACK,
      data: {
        ports: inspection.ports.map(
          ({ containerPort, hostIp }) => `${hostIp}:${String(containerPort)}`,
        ),
      },
    });
  }
};
