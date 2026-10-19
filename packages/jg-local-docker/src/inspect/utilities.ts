import { invalidOutput, isRecord } from '../shared/index.js';
import { PORT_KEY_PATTERN } from './constants.js';
import type { IContainerInspection, IContainerPort } from './types.js';

// a full container ID: 64 lowercase hexadecimal characters
const CONTAINER_ID_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Reads the published ports from `.NetworkSettings.Ports`: a map from a port such as '6379/tcp'
 * to its host bindings, or null when it's only exposed.
 * @param value The map, parsed from JSON.
 * @returns The ports, or undefined when the map isn't valid.
 */
const readPorts = (value: unknown): IContainerPort[] | undefined => {
  // a container without ports has none, or null for a stopped one
  if (value === null) {
    return [];
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const ports: IContainerPort[] = [];
  for (const [key, bindings] of Object.entries(value)) {
    const match = PORT_KEY_PATTERN.exec(key);
    if (match === null || (bindings !== null && !Array.isArray(bindings))) {
      return undefined;
    }
    for (const binding of (bindings ?? []) as unknown[]) {
      if (
        !isRecord(binding) ||
        typeof binding['HostIp'] !== 'string' ||
        typeof binding['HostPort'] !== 'string' ||
        !/^\d+$/.test(binding['HostPort'])
      ) {
        return undefined;
      }
      ports.push({
        containerPort: Number(match[1]),
        protocol: match[2] as string,
        hostIp: binding['HostIp'],
        hostPort: Number(binding['HostPort']),
      });
    }
  }
  return ports;
};

/**
 * Reads the healthcheck's status from `.State.Health`, which a container without a healthcheck
 * doesn't have.
 * @param value The health, parsed from JSON.
 * @returns The status, null without a healthcheck, or undefined when it isn't valid.
 */
const readHealth = (value: unknown): string | null | undefined => {
  if (value === undefined || value === null) {
    return null;
  }
  return isRecord(value) && typeof value['Status'] === 'string' ? value['Status'] : undefined;
};

/**
 * Parses what `docker inspect` writes with INSPECT_TEMPLATE, keeping the labels asked for.
 * @param stdout The command's stdout.
 * @param labelKeys The label keys to keep.
 * @returns The inspection.
 * @throws
 * - DOCKER_OUTPUT_INVALID: Docker's output isn't in the expected format.
 */
export const parseInspection = (
  stdout: string,
  labelKeys: readonly string[],
): IContainerInspection => {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw invalidOutput('inspect');
  }
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    !CONTAINER_ID_PATTERN.test(value['id']) ||
    typeof value['name'] !== 'string' ||
    !isRecord(value['state']) ||
    (value['labels'] !== null && !isRecord(value['labels']))
  ) {
    throw invalidOutput('inspect');
  }
  const health = readHealth(value['state']['Health']);
  const isRunning = value['state']['Running'];
  if (health === undefined || typeof isRunning !== 'boolean') {
    throw invalidOutput('inspect');
  }
  const ports = readPorts(value['ports']);
  if (ports === undefined) {
    throw invalidOutput('inspect');
  }
  const allLabels = value['labels'] ?? {};
  const labels: Record<string, string | null> = {};
  for (const key of labelKeys) {
    const label = Object.hasOwn(allLabels, key) ? allLabels[key] : null;
    if (label !== null && typeof label !== 'string') {
      throw invalidOutput('inspect');
    }
    labels[key] = label;
  }
  return {
    id: value['id'],
    name: value['name'].replace(/^\//, ''),
    isRunning,
    health,
    labels,
    ports,
  };
};
