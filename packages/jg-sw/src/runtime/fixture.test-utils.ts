import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeServiceWorker } from '../build/index.js';

// the built runtime and the jg-exception build it imports, served to the page
const PACKAGE_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATIC_DIRECTORIES: Record<string, string> = {
  '/jg-sw/': join(PACKAGE_DIRECTORY, 'dist'),
  '/jg-exception/': join(PACKAGE_DIRECTORY, 'node_modules', 'jg-exception', 'dist'),
};

// the content types the fixture serves
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// the page: it counts its loads in sessionStorage, which survives reloads, and registers the worker
const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>jg-sw fixture</title>
    <script type="importmap">
      { "imports": { "jg-exception": "/jg-exception/index.js" } }
    </script>
    <script type="module">
      import * as jgSw from '/jg-sw/runtime/index.js';
      sessionStorage.setItem('loads', String(Number(sessionStorage.getItem('loads') ?? 0) + 1));
      window.jgSw = jgSw;
      window.registration = jgSw.registerServiceWorker();
    </script>
  </head>
  <body>
    fixture
  </body>
</html>
`;

// how a version of the app is deployed
export type IDeployOptions = {
  // makes the new worker's install take this long, by delaying a file it precaches
  installDelayMs?: number;

  // makes the new worker's install fail, by precaching a file the server no longer has
  failInstall?: boolean;
};

// the fixture app's server
export type IFixtureServer = {
  origin: string;

  // builds the app's files and its worker for a version, and serves them from now on. Each
  // worker gets a random cache name, so the browser always finds a new worker after a deploy
  deploy: (version: string, options?: IDeployOptions) => Promise<void>;
  close: () => Promise<void>;
};

/**
 * Serves a file with its content type.
 * @param response The response.
 * @param path The file's path.
 * @param headers Extra headers.
 * @returns A promise that resolves to whether the file exists.
 */
const serveFile = async (
  response: ServerResponse,
  path: string,
  headers: Record<string, string> = {},
): Promise<boolean> => {
  try {
    if (!(await stat(path)).isFile()) {
      return false;
    }
  } catch {
    return false;
  }
  response.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(path)] ?? 'application/octet-stream',
    ...headers,
  });
  createReadStream(path).pipe(response);
  return true;
};

/**
 * Starts the fixture app's server on a free port, with nothing deployed yet.
 * @returns A promise that resolves to the server.
 */
export const startFixtureServer = async (): Promise<IFixtureServer> => {
  const appDirectory = await mkdtemp(join(tmpdir(), 'jg-sw-e2e-'));
  const outDir = join(appDirectory, 'dist');
  let installDelayMs = 0;

  const server: Server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const handle = async (): Promise<boolean> => {
      if (path === '/' || path === '/index.html') {
        response.writeHead(200, { 'Content-Type': CONTENT_TYPES['.html'] });
        response.end(INDEX_HTML);
        return true;
      }
      if (path === '/sw.js') {
        return serveFile(response, join(outDir, 'sw.js'), { 'Cache-Control': 'no-cache' });
      }
      if (path === '/no-store.txt') {
        response.writeHead(200, {
          'Content-Type': CONTENT_TYPES['.txt'],
          'Cache-Control': 'no-store',
        });
        response.end('never cached');
        return true;
      }
      if (path === '/cacheable.txt') {
        response.writeHead(200, { 'Content-Type': CONTENT_TYPES['.txt'] });
        response.end('cached');
        return true;
      }
      if (path === '/slow.txt') {
        await new Promise((resolve) => setTimeout(resolve, installDelayMs));
      }
      for (const [prefix, directory] of Object.entries(STATIC_DIRECTORIES)) {
        if (path.startsWith(prefix)) {
          return serveFile(response, join(directory, normalize(path.slice(prefix.length))));
        }
      }
      return serveFile(response, join(outDir, normalize(path)));
    };
    handle().then(
      (isServed) => {
        if (!isServed) {
          response.writeHead(404, { 'Content-Type': CONTENT_TYPES['.txt'] });
          response.end('Not found');
        }
      },
      (error: unknown) => {
        response.writeHead(500);
        response.end(String(error));
      },
    );
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    deploy: async (version, options = {}) => {
      const includeToPrecache = ['/version.txt'];
      await rm(outDir, { recursive: true, force: true });
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, 'version.txt'), version);
      installDelayMs = options.installDelayMs ?? 0;
      if (options.installDelayMs !== undefined) {
        await writeFile(join(outDir, 'slow.txt'), 'slow');
        includeToPrecache.push('/slow.txt');
      }
      if (options.failInstall === true) {
        await writeFile(join(outDir, 'broken.txt'), 'gone after the build');
        includeToPrecache.push('/broken.txt');
      }
      await writeServiceWorker(
        {
          outDir: 'dist',
          cacheNamePrefix: 'fixture-app',
          template: 'base',
          includeToPrecache,
          excludeFilesFromPrecache: [],
          excludeMIMETypesFromCache: [],
        },
        { cwd: appDirectory },
      );
      // the build needs the file, and the browser must not find it
      if (options.failInstall === true) {
        await rm(join(outDir, 'broken.txt'));
      }
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      await rm(appDirectory, { recursive: true, force: true });
    },
  };
};
