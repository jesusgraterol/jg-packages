import type { NestExpressApplication } from '@nestjs/platform-express';
import { VersioningType } from '@nestjs/common';
import { describe, expect, test } from 'vitest';

import { configureHttpApp } from './configure-http-app.js';

/**
 * Builds an app that records each call configureHttpApp makes, in order.
 * @returns The app and its calls, each as the method's name and its arguments.
 */
const createRecordingApp = () => {
  const calls: [string, ...unknown[]][] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  const app = {
    useBodyParser: record('useBodyParser'),
    use: record('use'),
    set: record('set'),
    enableVersioning: record('enableVersioning'),
    enableShutdownHooks: record('enableShutdownHooks'),
  } as unknown as NestExpressApplication;
  return { app, calls };
};

// a security middleware, compared by identity
const securityMiddleware = (): void => undefined;

describe('configureHttpApp', () => {
  test('runs every step in order', () => {
    const { app, calls } = createRecordingApp();

    configureHttpApp(app, {
      bodyLimit: '1mb',
      securityMiddleware,
      trustProxyHops: 2,
      versioning: { type: VersioningType.URI },
      shutdownSignals: ['SIGTERM'],
    });

    expect(calls.map(([name]) => name)).toStrictEqual([
      'useBodyParser',
      'useBodyParser',
      'use',
      'set',
      'use',
      'enableVersioning',
      'enableShutdownHooks',
    ]);
    expect(calls[0]).toStrictEqual(['useBodyParser', 'json', { limit: '1mb' }]);
    expect(calls[1]).toStrictEqual([
      'useBodyParser',
      'urlencoded',
      { extended: true, limit: '1mb' },
    ]);
    expect(calls[2]).toStrictEqual(['use', securityMiddleware]);
    expect(calls[3]).toStrictEqual(['set', 'trust proxy', 2]);
    expect(calls[4]?.[1]).toBeTypeOf('function');
    expect(calls[5]).toStrictEqual(['enableVersioning', { type: VersioningType.URI }]);
    expect(calls[6]).toStrictEqual(['enableShutdownHooks', ['SIGTERM']]);
  });

  test('skips the optional steps it isn’t given, and closes on SIGINT and SIGTERM', () => {
    const { app, calls } = createRecordingApp();

    configureHttpApp(app, { bodyLimit: 1024, requestLogging: false });

    expect(calls).toStrictEqual([
      ['useBodyParser', 'json', { limit: 1024 }],
      ['useBodyParser', 'urlencoded', { extended: true, limit: 1024 }],
      ['enableShutdownHooks', ['SIGINT', 'SIGTERM']],
    ]);
  });

  test.each([[0], [-1], [1.5], [Number.NaN]])('ignores %s trusted proxy hops', (trustProxyHops) => {
    const { app, calls } = createRecordingApp();

    configureHttpApp(app, { bodyLimit: '1mb', trustProxyHops, requestLogging: false });

    expect(calls.some(([name]) => name === 'set')).toBe(false);
  });
});
