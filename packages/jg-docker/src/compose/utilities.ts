import { invalidOutput, isRecord } from '../shared/index.js';
import { LOOPBACK_ADDRESSES } from './constants.js';
import type { IComposePublisher, IComposeService, IPublicPort } from './types.js';

/**
 * Checks whether a value is a non-negative integer, such as a port or an exit code.
 * @param value The value.
 * @returns Whether it is.
 */
const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/**
 * Reads one publisher of a `docker compose ps` entry.
 * @param value The publisher, parsed from JSON.
 * @returns The publisher, or undefined when it isn't one.
 */
const readPublisher = (value: unknown): IComposePublisher | undefined => {
  if (
    !isRecord(value) ||
    typeof value['URL'] !== 'string' ||
    !isNonNegativeInteger(value['TargetPort']) ||
    !isNonNegativeInteger(value['PublishedPort']) ||
    typeof value['Protocol'] !== 'string'
  ) {
    return undefined;
  }
  return {
    url: value['URL'],
    targetPort: value['TargetPort'],
    publishedPort: value['PublishedPort'],
    protocol: value['Protocol'],
  };
};

/**
 * Reads one `docker compose ps` entry.
 * @param value The entry, parsed from JSON.
 * @returns The service, or undefined when it isn't one.
 */
const readService = (value: unknown): IComposeService | undefined => {
  if (
    !isRecord(value) ||
    typeof value['ID'] !== 'string' ||
    typeof value['Name'] !== 'string' ||
    typeof value['Service'] !== 'string' ||
    typeof value['Project'] !== 'string' ||
    typeof value['State'] !== 'string' ||
    typeof value['Health'] !== 'string' ||
    !isNonNegativeInteger(value['ExitCode'])
  ) {
    return undefined;
  }
  // Compose writes null for a container without ports
  const rawPublishers = value['Publishers'] ?? [];
  if (!Array.isArray(rawPublishers)) {
    return undefined;
  }
  const publishers = rawPublishers.map(readPublisher);
  if (publishers.includes(undefined)) {
    return undefined;
  }
  return {
    id: value['ID'],
    name: value['Name'],
    service: value['Service'],
    project: value['Project'],
    state: value['State'],
    health: value['Health'],
    exitCode: value['ExitCode'],
    publishers: publishers as IComposePublisher[],
  };
};

/**
 * Parses JSON, or gives undefined when it isn't.
 * @param text The text.
 * @returns The value, or undefined.
 */
const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/**
 * Parses `docker compose ps --format json` output: one JSON object per line, as current Compose
 * writes it, or a single JSON array, with LF or CRLF line ends. Empty output is no services.
 * Entries keep Compose's order, duplicates included, so a caller can tell a service that runs
 * twice.
 * @param stdout The command's stdout.
 * @returns The services.
 * @example
 * import { parseComposePs } from 'jg-docker';
 *
 * const [service] = parseComposePs(
 *   '{"ID":"3d94","Name":"app-db-1","Service":"db","Project":"app","State":"running","Health":"healthy","ExitCode":0,"Publishers":[{"URL":"127.0.0.1","TargetPort":5432,"PublishedPort":5432,"Protocol":"tcp"}]}\n',
 * );
 * service?.health; // 'healthy'
 * @throws
 * - DOCKER_OUTPUT_INVALID: Docker's output isn't in the expected format.
 */
export const parseComposePs = (stdout: string): IComposeService[] => {
  const text = stdout.trim();
  if (text === '') {
    return [];
  }
  const values = text.startsWith('[')
    ? parseJson(text)
    : text
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '')
        .map((line) => parseJson(line));
  if (!Array.isArray(values)) {
    throw invalidOutput('compose ps');
  }
  return values.map((value) => {
    const service = readService(value);
    if (service === undefined) {
      throw invalidOutput('compose ps');
    }
    return service;
  });
};

/**
 * Finds the ports services publish on an address other than 127.0.0.1 or ::1, which another
 * machine may reach, such as `0.0.0.0` or `::`. A port that's only exposed to other containers
 * isn't published, so it's left out.
 * @param services The services, such as listComposeServices gives.
 * @returns The public ports, in the services' order.
 * @example
 * import { findPublicPorts, listComposeServices } from 'jg-docker';
 *
 * declare const host: string;
 *
 * const services = await listComposeServices({ cwd: '/srv/app', host });
 * if (findPublicPorts(services).length > 0) {
 *   // bind the ports to 127.0.0.1 in compose.yaml
 * }
 */
export const findPublicPorts = (services: readonly IComposeService[]): IPublicPort[] =>
  services.flatMap(({ service, name, publishers }) =>
    publishers
      .filter(({ url, publishedPort }) => publishedPort !== 0 && !LOOPBACK_ADDRESSES.has(url))
      .map((publisher) => ({ ...publisher, service, name })),
  );
