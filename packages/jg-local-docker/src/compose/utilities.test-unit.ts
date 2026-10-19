// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import type { IComposeService } from './types.js';
import { findPublicPorts, parseComposePs } from './utilities.js';

// one `docker compose ps --format json` entry, as Compose writes it, with fields jg-local-docker ignores
const buildEntry = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  Command: '"docker-entrypoint.sh redis-server"',
  ExitCode: 0,
  Health: 'healthy',
  ID: 'a'.repeat(64),
  Image: 'redis:8.6.2-alpine',
  Labels: 'com.docker.compose.project=app',
  Name: 'app-cache-1',
  Project: 'app',
  Publishers: [{ URL: '127.0.0.1', TargetPort: 6379, PublishedPort: 6380, Protocol: 'tcp' }],
  Service: 'cache',
  State: 'running',
  Status: 'Up 2 minutes (healthy)',
  ...overrides,
});

const CACHE: IComposeService = {
  id: 'a'.repeat(64),
  name: 'app-cache-1',
  service: 'cache',
  project: 'app',
  state: 'running',
  health: 'healthy',
  exitCode: 0,
  publishers: [{ url: '127.0.0.1', targetPort: 6379, publishedPort: 6380, protocol: 'tcp' }],
};

const DB_ENTRY = buildEntry({
  ID: 'b'.repeat(64),
  Name: 'app-db-1',
  Service: 'db',
  Health: '',
  Publishers: null,
});
const DB: IComposeService = {
  ...CACHE,
  id: 'b'.repeat(64),
  name: 'app-db-1',
  service: 'db',
  health: '',
  publishers: [],
};

describe('parseComposePs', () => {
  test('reads one JSON object per line', () => {
    const stdout = `${JSON.stringify(buildEntry())}\n${JSON.stringify(DB_ENTRY)}\n`;

    expect(parseComposePs(stdout)).toStrictEqual([CACHE, DB]);
  });

  test('reads a JSON array', () => {
    expect(parseComposePs(JSON.stringify([buildEntry(), DB_ENTRY]))).toStrictEqual([CACHE, DB]);
  });

  test('reads CRLF line ends and blank lines', () => {
    const stdout = `${JSON.stringify(buildEntry())}\r\n\r\n${JSON.stringify(DB_ENTRY)}\r\n`;

    expect(parseComposePs(stdout)).toStrictEqual([CACHE, DB]);
  });

  test.each(['', '\n', '  \r\n', '[]'])('reads %o as no services', (stdout) => {
    expect(parseComposePs(stdout)).toStrictEqual([]);
  });

  test('keeps a service that appears twice, in order, for the caller to catch', () => {
    const second = buildEntry({ ID: 'c'.repeat(64), Name: 'app-cache-2' });

    expect(
      parseComposePs(`${JSON.stringify(buildEntry())}\n${JSON.stringify(second)}\n`).map(
        ({ service, name }) => [service, name],
      ),
    ).toStrictEqual([
      ['cache', 'app-cache-1'],
      ['cache', 'app-cache-2'],
    ]);
  });

  test('reads an exited container and a port only exposed to other containers', () => {
    const entry = buildEntry({
      State: 'exited',
      ExitCode: 137,
      Health: '',
      Publishers: [{ URL: '', TargetPort: 6379, PublishedPort: 0, Protocol: 'tcp' }],
    });

    expect(parseComposePs(JSON.stringify(entry))).toStrictEqual([
      {
        ...CACHE,
        state: 'exited',
        exitCode: 137,
        health: '',
        publishers: [{ url: '', targetPort: 6379, publishedPort: 0, protocol: 'tcp' }],
      },
    ]);
  });

  test.each([
    ['a line that is not JSON', `${JSON.stringify(buildEntry())}\nError: no configuration file\n`],
    ['an array that is not closed', `[${JSON.stringify(buildEntry())}`],
    ['a JSON value that is not an object', '42'],
    ['an array of strings', '["app-cache-1"]'],
    ['an entry without its service', JSON.stringify(buildEntry({ Service: undefined }))],
    ['an entry whose ID is a number', JSON.stringify(buildEntry({ ID: 1 }))],
    ['a negative exit code', JSON.stringify(buildEntry({ ExitCode: -1 }))],
    ['publishers that are not an array', JSON.stringify(buildEntry({ Publishers: {} }))],
    [
      'a publisher whose port is a string',
      JSON.stringify(
        buildEntry({
          Publishers: [{ URL: '', TargetPort: '6379', PublishedPort: 0, Protocol: 'tcp' }],
        }),
      ),
    ],
    ['a publisher that is not an object', JSON.stringify(buildEntry({ Publishers: ['6379'] }))],
  ])('rejects %s', (_description, stdout) => {
    expectToThrowCode(() => parseComposePs(stdout), ERRORS.DOCKER_OUTPUT_INVALID);
  });
});

describe('findPublicPorts', () => {
  /**
   * Builds a service that publishes ports.
   * @param service The service's name.
   * @param publishers Each publisher's address and host port.
   * @returns The service.
   */
  const buildService = (service: string, publishers: [string, number][]): IComposeService => ({
    ...CACHE,
    service,
    name: `app-${service}-1`,
    publishers: publishers.map(([url, publishedPort]) => ({
      url,
      targetPort: 6379,
      publishedPort,
      protocol: 'tcp',
    })),
  });

  test('accepts ports published on 127.0.0.1 or ::1 only', () => {
    expect(
      findPublicPorts([
        buildService('cache', [
          ['127.0.0.1', 6380],
          ['::1', 6380],
        ]),
      ]),
    ).toStrictEqual([]);
  });

  test('flags both halves of a dual-stack port published on every interface', () => {
    expect(
      findPublicPorts([
        buildService('cache', [
          ['0.0.0.0', 6380],
          ['::', 6380],
        ]),
      ]),
    ).toStrictEqual([
      {
        service: 'cache',
        name: 'app-cache-1',
        url: '0.0.0.0',
        targetPort: 6379,
        publishedPort: 6380,
        protocol: 'tcp',
      },
      {
        service: 'cache',
        name: 'app-cache-1',
        url: '::',
        targetPort: 6379,
        publishedPort: 6380,
        protocol: 'tcp',
      },
    ]);
  });

  test('flags a port on another address, such as a LAN one, and keeps the services in order', () => {
    const ports = findPublicPorts([
      buildService('db', [['192.168.1.20', 5432]]),
      buildService('cache', [['127.0.0.1', 6380]]),
      buildService('web', [['127.0.0.2', 8080]]),
    ]);

    expect(ports.map(({ service, url }) => [service, url])).toStrictEqual([
      ['db', '192.168.1.20'],
      ['web', '127.0.0.2'],
    ]);
  });

  test('ignores a port that is only exposed to other containers', () => {
    expect(
      findPublicPorts([
        buildService('cache', [
          ['', 0],
          ['0.0.0.0', 0],
        ]),
      ]),
    ).toStrictEqual([]);
  });

  test('finds nothing without services', () => {
    expect(findPublicPorts([])).toStrictEqual([]);
  });
});
