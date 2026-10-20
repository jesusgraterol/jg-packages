import { createServer, type Server } from 'node:net';

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { listenHttpApp } from './listen-http-app.js';

// counts the times the app's modules were torn down
const destroyed = vi.fn();

@Injectable()
class TrackedResource implements OnModuleDestroy {
  public onModuleDestroy(): void {
    destroyed();
  }
}

/**
 * Creates an app, not yet listening, with one provider.
 * @param provider The provider.
 * @returns A promise that resolves to the app.
 */
const createApp = async (provider: new () => object) => {
  const module = await Test.createTestingModule({ providers: [provider] }).compile();
  return module.createNestApplication({ logger: false });
};

let occupied: Server;
let occupiedPort: number;

beforeAll(async () => {
  occupied = createServer();
  await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', resolve));
  occupiedPort = (occupied.address() as { port: number }).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => occupied.close(() => resolve()));
});

afterEach(() => {
  destroyed.mockClear();
  vi.restoreAllMocks();
});

describe('listenHttpApp', () => {
  test('listens on the port and host', async () => {
    const app = await createApp(TrackedResource);

    await listenHttpApp(app, { port: 0, host: '127.0.0.1' });

    try {
      const response = await fetch(`${await app.getUrl()}/missing`);
      expect(response.status).toBe(404);
      expect(destroyed).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  test('listens on every interface without a host', async () => {
    const app = await createApp(TrackedResource);

    await listenHttpApp(app, { port: 0 });

    try {
      const { port } = new URL(await app.getUrl());
      expect((await fetch(`http://127.0.0.1:${port}/missing`)).status).toBe(404);
    } finally {
      await app.close();
    }
  });

  test('closes the app and rethrows when the port is taken', async () => {
    const app = await createApp(TrackedResource);
    const logError = vi.spyOn(Logger.prototype, 'error');

    await expect(
      listenHttpApp(app, { port: occupiedPort, host: '127.0.0.1' }),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' });
    expect(destroyed).toHaveBeenCalledTimes(1);
    expect(logError).not.toHaveBeenCalledWith(
      'The app failed to close after it failed to listen.',
      expect.anything(),
    );
  });

  test('logs a failure to close, and still rethrows the listen error', async () => {
    const app = await createApp(TrackedResource);
    // Nest logs a failing lifecycle hook itself, so close rejects only when something else fails
    vi.spyOn(app, 'close').mockRejectedValue(new Error('The server failed to close.'));
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(
      listenHttpApp(app, { port: occupiedPort, host: '127.0.0.1' }),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' });
    expect(logError).toHaveBeenCalledWith(
      'The app failed to close after it failed to listen.',
      expect.objectContaining({ message: 'The server failed to close.' }),
    );
  });
});
