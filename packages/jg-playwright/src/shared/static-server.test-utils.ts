import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

// one response the server sends for a path
export type IStaticResponse = {
  body: string | Buffer;
  contentType: string;

  // how long the server waits before it answers, such as to keep an image loading
  delayMs?: number;
};

// a local server for the test pages, on a random loopback port
export type IStaticServer = {
  origin: string;
  close: () => Promise<void>;
};

// a 1×1 transparent PNG, for pages with images
export const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Wraps a body in a minimal HTML document.
 * @param body The body's markup.
 * @param head Extra markup for the head, such as a style element.
 * @returns The document.
 */
export const toHtmlPage = (body: string, head = ''): IStaticResponse => ({
  contentType: 'text/html; charset=utf-8',
  body: `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Test page</title>${head}</head><body>${body}</body></html>`,
});

/**
 * Serves fixed responses by path, and 404 for anything else.
 * @param responses The responses, by path, such as '/'.
 * @returns A promise that resolves to the server.
 */
export const startStaticServer = async (
  responses: Record<string, IStaticResponse>,
): Promise<IStaticServer> => {
  const server = createServer((request, response) => {
    const found = responses[new URL(request.url ?? '/', 'http://localhost').pathname];
    if (found === undefined) {
      response.writeHead(404).end();
      return;
    }
    setTimeout(() => {
      response.writeHead(200, { 'content-type': found.contentType }).end(found.body);
    }, found.delayMs ?? 0);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      }),
  };
};
