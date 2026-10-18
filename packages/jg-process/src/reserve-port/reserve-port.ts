import { type AddressInfo, createServer, type Server } from 'node:net';
import { Exception, getErrorCode } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import type { IPortReservation, IReservePortOptions } from './types.js';

// the address a port is reserved on unless another is given
const DEFAULT_HOST = '127.0.0.1';

// the highest TCP port
const MAX_PORT = 65_535;

/**
 * Starts a server listening, and settles once it listens or fails to, removing its listeners
 * either way.
 * @param server The server.
 * @param port The port, 0 for any free one.
 * @param host The address.
 * @returns A promise that resolves once the server listens, and rejects with the listen error.
 */
const listen = (server: Server, port: number, host: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      removeListeners();
      reject(error);
    };
    const onListening = (): void => {
      removeListeners();
      resolve();
    };
    const removeListeners = (): void => {
      server.off('error', onError);
      server.off('listening', onListening);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen({ port, host, exclusive: true });
  });

/**
 * Reserves a free TCP port by listening on it, so nothing else can take it until it's released,
 * such as before passing it to a dev server or a test fixture. The preferred port is kept when
 * it's free, and any free port is reserved when it's taken. Connections to the reserved port are
 * closed at once, and the reservation doesn't keep the process running.
 *
 * A child process that needs the port itself can't bind it while it's reserved, so release it
 * right before starting the child. Another process can take the port in between.
 * @param options The preferred port and the address. The address defaults to 127.0.0.1.
 * @returns A promise that resolves to the reservation.
 * @example
 * import { reservePort } from 'jg-process';
 *
 * const reservation = await reservePort({ preferredPort: 3000 });
 * console.log(`The port is ${reservation.port}`); // 3000, or another free port when it's taken
 * await reservation.release();
 * @throws
 * - INVALID_PORT: The preferred port must be an integer from 1 to 65535.
 * - PORT_RESERVATION_FAILED: The port couldn't be reserved.
 */
export const reservePort = async ({
  preferredPort,
  host = DEFAULT_HOST,
}: IReservePortOptions = {}): Promise<IPortReservation> => {
  if (
    preferredPort !== undefined &&
    !(Number.isInteger(preferredPort) && preferredPort >= 1 && preferredPort <= MAX_PORT)
  ) {
    throw new Exception('The preferred port must be an integer from 1 to 65535.', {
      code: ERRORS.INVALID_PORT,
      data: { preferredPort: String(preferredPort) },
    });
  }
  const server = createServer((socket) => {
    socket.destroy();
  });
  server.unref();
  try {
    try {
      await listen(server, preferredPort ?? 0, host);
    } catch (error) {
      if (preferredPort === undefined || getErrorCode(error) !== 'EADDRINUSE') {
        throw error;
      }
      await listen(server, 0, host);
    }
  } catch (error) {
    throw new Exception("The port couldn't be reserved.", {
      code: ERRORS.PORT_RESERVATION_FAILED,
      data: { host, preferredPort: preferredPort ?? null },
      cause: error,
    });
  }
  // a TCP server's address is an AddressInfo once it listens
  const { port } = server.address() as AddressInfo;
  let closing: Promise<void> | undefined;
  return {
    port,
    host,
    release: () => {
      closing ??= new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      return closing;
    },
  };
};
