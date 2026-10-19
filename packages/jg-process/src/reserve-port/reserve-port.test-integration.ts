// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { type AddressInfo, connect, createServer, type Server } from 'node:net';
import { fileURLToPath } from 'node:url';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { reservePort } from './reserve-port.js';
import type { IPortReservation } from './types.js';

// the package's directory, from which a child process imports the built jg-process
const PACKAGE_DIRECTORY = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Starts a server on a port, as another process holding it would.
 * @param port The port, 0 for any free one.
 * @returns A promise that resolves to the listening server.
 */
const occupyPort = (port: number): Promise<Server> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ port, host: '127.0.0.1' }, () => {
      resolve(server);
    });
  });

/**
 * Stops a server.
 * @param server The server.
 * @returns A promise that resolves once it's closed.
 */
const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });

describe('reservePort', () => {
  const reservations: IPortReservation[] = [];
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(reservations.splice(0).map((reservation) => reservation.release()));
    await Promise.all(servers.splice(0).map(closeServer));
  });

  /**
   * Reserves a port, released after the test.
   * @param options The options.
   * @returns A promise that resolves to the reservation.
   */
  const reserve = async (
    options?: Parameters<typeof reservePort>[0],
  ): Promise<IPortReservation> => {
    const reservation = await reservePort(options);
    reservations.push(reservation);
    return reservation;
  };

  test('reserves a free port the OS assigns, on 127.0.0.1, and holds it', async () => {
    const reservation = await reserve();

    expect(reservation.host).toBe('127.0.0.1');
    expect(reservation.port).toBeGreaterThan(0);
    await expect(occupyPort(reservation.port)).rejects.toMatchObject({ code: 'EADDRINUSE' });
  });

  test('keeps the preferred port when it is free', async () => {
    const probe = await occupyPort(0);
    const { port } = probe.address() as AddressInfo;
    await closeServer(probe);

    const reservation = await reserve({ preferredPort: port });

    expect(reservation.port).toBe(port);
  });

  test('reserves another free port when the preferred one is taken', async () => {
    const holder = await occupyPort(0);
    servers.push(holder);
    const { port } = holder.address() as AddressInfo;

    const reservation = await reserve({ preferredPort: port });

    expect(reservation.port).not.toBe(port);
    expect(reservation.port).toBeGreaterThan(0);
  });

  test('closes every connection to the reserved port at once', async () => {
    const reservation = await reserve();
    const socket = connect({ port: reservation.port, host: '127.0.0.1' });
    const received: Buffer[] = [];
    socket.on('data', (chunk: Buffer) => received.push(chunk));
    socket.on('error', () => undefined);

    await new Promise((resolve) => socket.once('close', resolve));

    expect(received).toStrictEqual([]);
  });

  test('frees the port on release, and does nothing when released again', async () => {
    const reservation = await reservePort();

    await Promise.all([reservation.release(), reservation.release()]);
    await reservation.release();
    servers.push(await occupyPort(reservation.port));
  });

  test("doesn't keep the process running", () => {
    const { status, error } = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import { reservePort } from 'jg-process'; await reservePort();",
      ],
      { cwd: PACKAGE_DIRECTORY, timeout: 10_000 },
    );

    expect(error).toBeUndefined();
    expect(status).toBe(0);
  });

  test.each([[0], [-1], [65_536], [1.5], [Number.NaN]])(
    'rejects the preferred port %d',
    async (preferredPort) => {
      await expectToRejectCode(
        reservePort({ preferredPort }),
        ERRORS.INVALID_PORT,
        'The preferred port must be an integer from 1 to 65535.',
      );
    },
  );

  test("fails, without trying another port, when the address isn't this machine's", async () => {
    await expect(reservePort({ preferredPort: 3000, host: '203.0.113.1' })).rejects.toMatchObject({
      code: ERRORS.PORT_RESERVATION_FAILED,
      message: "The port couldn't be reserved.",
      data: { host: '203.0.113.1', preferredPort: 3000 },
      cause: expect.objectContaining({ code: 'EADDRNOTAVAIL' }) as unknown,
    });
  });

  test('fails when no port can be reserved on the address', async () => {
    await expect(reservePort({ host: '203.0.113.1' })).rejects.toMatchObject({
      code: ERRORS.PORT_RESERVATION_FAILED,
      data: { host: '203.0.113.1', preferredPort: null },
    });
  });
});
