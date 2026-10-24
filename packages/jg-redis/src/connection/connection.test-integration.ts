import net from 'node:net';
import { expectToRejectCode } from 'jg-exception/testing';
import { ReconnectStrategyError } from 'redis';
import type * as Redis from 'redis';
import { afterEach, describe, expect, inject, test, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { connectTestRedis, createTestKey } from '../test-utils/redis.js';

import { connectRedis } from './connection.js';
import type { IRedis, IRedisClient } from './types.js';

// every client connectRedis creates, newest last, with a spy on its connect, so a test can inspect
// one after a rejection
const createdClients = vi.hoisted(
  (): { client: IRedisClient; connect: MockInstance<IRedisClient['connect']> }[] => [],
);

// passes through to node-redis, recording each client and watching its connect
vi.mock('redis', async (importOriginal) => {
  const actual = await importOriginal<typeof Redis>();
  return {
    ...actual,
    createClient: (...args: Parameters<typeof actual.createClient>) => {
      const client = actual.createClient(...args);
      createdClients.push({ client, connect: vi.spyOn(client, 'connect') });
      return client;
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const { client } of createdClients.splice(0)) {
    if (client.isOpen) client.destroy();
  }
});

/**
 * Ends one client's connection from the server's side, as a restart or a network failure would,
 * leaving every other test's clients alone.
 * @param redis The client.
 * @returns A promise that resolves once the server dropped it.
 */
const killClient = async (redis: IRedis): Promise<void> => {
  const id = await redis.client.clientId();
  const admin = await connectTestRedis();
  try {
    await admin.client.sendCommand(['CLIENT', 'KILL', 'ID', String(id)]);
  } finally {
    await admin.close();
  }
};

/**
 * Finds a loopback port nothing listens on, by letting the system pick a free one and closing it.
 * @returns A promise that resolves to the port.
 */
const findClosedPort = async (): Promise<number> => {
  const server = net.createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
  if (address === null || typeof address === 'string') throw new Error('No TCP port was assigned.');
  return address.port;
};

/**
 * Reads the client connectRedis created last.
 * @returns The client, and the spy on its connect.
 */
const readLastClient = (): (typeof createdClients)[number] => {
  const created = createdClients.at(-1);
  if (created === undefined) throw new Error('connectRedis created no client.');
  return created;
};

/**
 * Creates a socket that connects only when the test calls its connect, because node-redis's own
 * per-attempt timeout, set through setTimeout, would otherwise destroy it first.
 * @returns The socket.
 */
const createHeldSocket = (): net.Socket => {
  const socket = new net.Socket();
  vi.spyOn(socket, 'setTimeout').mockReturnThis();
  return socket;
};

describe('connectRedis', () => {
  test('rejects commands while disconnected instead of queueing them, and gives up connecting after 10 seconds', async () => {
    const redis = await connectTestRedis();
    try {
      expect(redis.client.options).toMatchObject({
        disableOfflineQueue: true,
        socket: { connectTimeout: 10_000 },
      });
    } finally {
      await redis.close();
    }
  });

  test('keeps the data when it closes', async () => {
    const key = createTestKey('kept');
    const first = await connectTestRedis();
    await first.client.set(key, 'value', { EX: 60 });
    await first.close();

    const second = await connectTestRedis();
    try {
      await expect(second.client.get(key)).resolves.toBe('value');
    } finally {
      await second.close();
    }
  });

  test('reports a dropped connection to onError instead of crashing', async () => {
    const onError = vi.fn();
    const redis = await connectTestRedis({ onError });
    try {
      await killClient(redis);
      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    } finally {
      await redis.close().catch(() => undefined);
    }
  });

  test('reports to console.error without an onError', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const redis = await connectTestRedis();
    try {
      await killClient(redis);
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });
    } finally {
      await redis.close().catch(() => undefined);
    }
  });

  test(
    'rejects with CONNECTION_FAILED once connectTimeout passes without a first connection, and stops reconnecting',
    { timeout: 5_000 },
    async () => {
      const port = await findClosedPort();

      const connecting = connectRedis({
        socket: { host: '127.0.0.1', port, connectTimeout: 300 },
        onError: () => undefined,
      });

      await expectToRejectCode(connecting, ERRORS.CONNECTION_FAILED, 'Could not connect to Redis.');
      const failure = await connecting.catch((error: unknown) => error);
      expect(failure).toHaveProperty('cause', expect.any(Error));
      const { client, connect } = readLastClient();
      // an attempt still running at the deadline closes the client when it fails, just after
      await vi.waitFor(() => {
        expect(client.isOpen).toBe(false);
      });
      // node-redis's own connect ends instead of retrying forever
      await expect(connect.mock.results[0]?.value).resolves.toBe(client);
    },
  );

  test('rejects with CONNECTION_FAILED as soon as the reconnect strategy gives up', async () => {
    const port = await findClosedPort();
    const refusal = new Error('stop reconnecting');

    const connecting = connectRedis({
      socket: { host: '127.0.0.1', port, reconnectStrategy: () => refusal },
      onError: () => undefined,
    });

    await expectToRejectCode(connecting, ERRORS.CONNECTION_FAILED, 'Could not connect to Redis.');
    const failure = await connecting.catch((error: unknown) => error);
    expect(failure).toHaveProperty('cause', expect.any(ReconnectStrategyError));
    expect(failure).toHaveProperty('cause.originalError', refusal);
    expect(readLastClient().client.isOpen).toBe(false);
  });

  test('destroys an attempt that connects after the deadline', async () => {
    const port = await findClosedPort();
    const redisUrl = new URL(inject('redisUrl'));
    const held = createHeldSocket();
    let hasConnected = false;
    held.once('connect', () => {
      hasConnected = true;
    });
    // the first attempt is refused, and the retry gets the held socket
    const createConnection = vi
      .spyOn(net, 'createConnection')
      .mockImplementationOnce(net.createConnection)
      .mockImplementationOnce(() => held);
    try {
      const connecting = connectRedis({
        socket: { host: '127.0.0.1', port, connectTimeout: 1_000 },
        onError: () => undefined,
      });

      await expectToRejectCode(connecting, ERRORS.CONNECTION_FAILED);
      const { client } = readLastClient();
      expect(createConnection).toHaveBeenCalledTimes(2);
      expect(held.connecting).toBe(false);
      expect(held.destroyed).toBe(false);

      held.connect(Number(redisUrl.port), redisUrl.hostname);
      await vi.waitFor(() => {
        expect(held.destroyed).toBe(true);
      });
      expect(hasConnected).toBe(true);
      expect(client.isReady).toBe(false);
    } finally {
      held.destroy();
    }
  });

  test('leaves the failure to node-redis when the reconnect strategy closes the client after the deadline', async () => {
    const port = await findClosedPort();
    const held = createHeldSocket();
    vi.spyOn(net, 'createConnection').mockImplementationOnce(() => held);
    const onError = vi.fn();
    const lateFailure = new Error('the attempt failed after the deadline');
    try {
      const connecting = connectRedis({
        socket: { host: '127.0.0.1', port, connectTimeout: 300, reconnectStrategy: false },
        onError,
      });

      await expectToRejectCode(connecting, ERRORS.CONNECTION_FAILED);
      const { client, connect } = readLastClient();
      held.destroy(lateFailure);

      // node-redis closes the client before it reports the error, so the cleanup leaves it be
      await expect(connect.mock.results[0]?.value).rejects.toBe(lateFailure);
      expect(onError).toHaveBeenCalledWith(lateFailure);
      expect(client.isOpen).toBe(false);
    } finally {
      held.destroy();
    }
  });
});
