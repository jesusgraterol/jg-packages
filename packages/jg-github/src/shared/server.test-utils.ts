import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// answers one request; the attempt counts the requests to the same path, starting at 1
export type IRouteHandler = (
  request: IncomingMessage & { body: string },
  response: ServerResponse,
  attempt: number,
) => void | Promise<void>;

// a local server whose routes each test sets
export type ITestServer = {
  origin: string;

  // answers a path, replacing an earlier handler
  route: (path: string, handler: IRouteHandler) => void;

  // the requests each path received, in order
  requests: (path: string) => (IncomingMessage & { body: string })[];

  // every request received, on any path
  requestCount: () => number;

  // forgets the routes and the requests, for the next test
  reset: () => void;
  close: () => Promise<void>;
};

/**
 * Starts a server on 127.0.0.1 and a free port. Unknown paths answer 404.
 * @returns A promise that resolves to the server.
 */
export const startTestServer = async (): Promise<ITestServer> => {
  const handlers = new Map<string, IRouteHandler>();
  const received = new Map<string, (IncomingMessage & { body: string })[]>();
  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      const withBody = Object.assign(request, { body: Buffer.concat(chunks).toString('utf8') });
      const list = received.get(path) ?? [];
      list.push(withBody);
      received.set(path, list);
      const handler = handlers.get(path);
      if (handler === undefined) {
        response.writeHead(404).end();
        return;
      }
      Promise.resolve(handler(withBody, response, list.length)).catch((error: unknown) => {
        response.writeHead(500).end(String(error));
      });
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    route: (path, handler) => {
      handlers.set(path, handler);
    },
    requests: (path) => received.get(path) ?? [],
    requestCount: () => [...received.values()].reduce((count, list) => count + list.length, 0),
    reset: () => {
      handlers.clear();
      received.clear();
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
};

/**
 * Sends a JSON body.
 * @param response The response.
 * @param status The status.
 * @param body The value to send as JSON.
 * @param headers Extra headers.
 */
export const sendJson = (
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void => {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
};
