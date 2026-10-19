// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { parseInspection } from './utilities.js';

const ID = 'd'.repeat(64);

/**
 * Builds what `docker inspect` writes with the package's template.
 * @param overrides The fields to replace.
 * @returns The output, as JSON.
 */
const buildOutput = (overrides: Record<string, unknown> = {}): string =>
  `${JSON.stringify({
    id: ID,
    name: '/app-cache-1',
    state: {
      Status: 'running',
      Running: true,
      ExitCode: 0,
      Health: { Status: 'healthy', FailingStreak: 0 },
    },
    labels: {
      'com.docker.compose.project': 'app',
      'com.docker.compose.service': 'cache',
      empty: '',
    },
    ports: {
      '6379/tcp': [
        { HostIp: '127.0.0.1', HostPort: '6380' },
        { HostIp: '::1', HostPort: '6380' },
      ],
    },
    ...overrides,
  })}\n`;

test('reads the fields, without the leading slash, and only the labels asked for', () => {
  expect(
    parseInspection(buildOutput(), ['com.docker.compose.project', 'empty', 'missing']),
  ).toStrictEqual({
    id: ID,
    name: 'app-cache-1',
    isRunning: true,
    health: 'healthy',
    labels: { 'com.docker.compose.project': 'app', empty: '', missing: null },
    ports: [
      { containerPort: 6379, protocol: 'tcp', hostIp: '127.0.0.1', hostPort: 6380 },
      { containerPort: 6379, protocol: 'tcp', hostIp: '::1', hostPort: 6380 },
    ],
  });
});

test('reads a stopped container without a healthcheck, labels, or ports', () => {
  expect(
    parseInspection(
      buildOutput({
        state: { Status: 'exited', Running: false, ExitCode: 0 },
        labels: null,
        ports: null,
      }),
      ['owner'],
    ),
  ).toStrictEqual({
    id: ID,
    name: 'app-cache-1',
    isRunning: false,
    health: null,
    labels: { owner: null },
    ports: [],
  });
});

test('leaves out a port that is only exposed, and reads several protocols', () => {
  const output = buildOutput({
    ports: {
      '6379/tcp': null,
      '53/udp': [{ HostIp: '0.0.0.0', HostPort: '5353' }],
    },
  });

  expect(parseInspection(output, []).ports).toStrictEqual([
    { containerPort: 53, protocol: 'udp', hostIp: '0.0.0.0', hostPort: 5353 },
  ]);
});

test('ignores labels inherited from the prototype', () => {
  expect(parseInspection(buildOutput({ labels: {} }), ['toString']).labels).toStrictEqual({
    toString: null,
  });
});

test.each([
  ['output that is not JSON', 'Error: template parsing error'],
  ['a JSON value that is not an object', '[]'],
  ['a short ID', buildOutput({ id: 'd'.repeat(12) })],
  ['a name that is not a string', buildOutput({ name: null })],
  ['a state that is not an object', buildOutput({ state: 'running' })],
  ['a running state that is not a boolean', buildOutput({ state: { Running: 'true' } })],
  ['a health without a status', buildOutput({ state: { Running: true, Health: {} } })],
  ['a health that is not an object', buildOutput({ state: { Running: true, Health: 'healthy' } })],
  ['labels that are not an object', buildOutput({ labels: ['owner'] })],
  ['a label that is not a string', buildOutput({ labels: { owner: 1 } })],
  ['ports that are not an object', buildOutput({ ports: [] })],
  ['a port key without a protocol', buildOutput({ ports: { '6379': null } })],
  ['bindings that are not an array', buildOutput({ ports: { '6379/tcp': {} } })],
  [
    'a binding without a host port',
    buildOutput({ ports: { '6379/tcp': [{ HostIp: '127.0.0.1' }] } }),
  ],
  [
    'a binding whose host port is not a number',
    buildOutput({ ports: { '6379/tcp': [{ HostIp: '127.0.0.1', HostPort: 'x1' }] } }),
  ],
  ['a binding that is not an object', buildOutput({ ports: { '6379/tcp': ['127.0.0.1:6380'] } })],
])('rejects %s', (_description, stdout) => {
  expectToThrowCode(() => parseInspection(stdout, ['owner']), ERRORS.DOCKER_OUTPUT_INVALID);
});
