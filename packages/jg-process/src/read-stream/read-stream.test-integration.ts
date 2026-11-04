// @vitest-environment node
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { hasErrorCode } from 'jg-exception';
import { afterEach, describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { readStream } from './read-stream.js';

let server: Server | null = null;

afterEach(async () => {
  await new Promise<void>((resolve) => {
    if (server === null) resolve();
    else server.close(() => resolve());
  });
  server = null;
});

// a server that echoes a body of at most 8 bytes, and answers a larger one with a 413
const startServer = async (): Promise<string> => {
  server = createServer((request, response) => {
    void readStream(request, { maxBytes: 8 }).then(
      (body) => response.end(body),
      (error: unknown) => {
        response.statusCode = hasErrorCode(error, ERRORS.STREAM_TOO_LARGE) ? 413 : 500;
        response.setHeader('connection', 'close');
        response.end();
      },
    );
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};

describe('readStream on a request body', () => {
  test('reads a body within the limit', async () => {
    const origin = await startServer();

    const response = await fetch(origin, { method: 'POST', body: 'eight by' });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('eight by');
  });

  test('refuses a larger body, and the server still answers it', async () => {
    const origin = await startServer();

    const response = await fetch(origin, { method: 'POST', body: 'nine byte' });

    expect(response.status).toBe(413);
  });
});
