import { VersioningType } from '@nestjs/common';
import { afterEach, describe, expect, test } from 'vitest';

import { startHttpApp, type ITestHttpApp } from '../test-utils/http-app.js';
import { PingModule } from './ping.module.js';

let server: ITestHttpApp | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('PingModule', () => {
  test('answers 204 with no body at /ping when the routes are versioned in the URI', async () => {
    server = await startHttpApp({ imports: [PingModule] }, (app) => {
      app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    });

    const response = await fetch(`${server.baseUrl}/ping`);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  test.each([['7'], [undefined]])(
    'answers 204 whatever version a header asks for (%s)',
    async (version) => {
      server = await startHttpApp({ imports: [PingModule] }, (app) => {
        app.enableVersioning({ type: VersioningType.HEADER, header: 'x-api-version' });
      });

      const response = await fetch(`${server.baseUrl}/ping`, {
        headers: version === undefined ? {} : { 'x-api-version': version },
      });

      expect(response.status).toBe(204);
    },
  );

  test('answers 204 in an app without versioning, and only to GET', async () => {
    server = await startHttpApp({ imports: [PingModule] });

    expect((await fetch(`${server.baseUrl}/ping`)).status).toBe(204);
    expect((await fetch(`${server.baseUrl}/ping`, { method: 'POST' })).status).toBe(404);
  });
});
