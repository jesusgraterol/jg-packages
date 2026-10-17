import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { build, createServer, type ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { pathExists } from 'jg-fs';
import type { IServiceWorkerConfig } from '../config/index.js';
import { serviceWorkerPlugin } from './plugin.js';

// the config the fixture app generates its worker from
const CONFIG: IServiceWorkerConfig = {
  outDir: 'dist',
  cacheNamePrefix: 'fixture-app',
  template: 'base',
  includeToPrecache: ['/', '/index.html', '/assets'],
  excludeFilesFromPrecache: [],
  excludeMIMETypesFromCache: [],
};

let root: string;
let server: ViteDevServer | undefined;

/**
 * Reads a generated worker's constant by running the worker in a fresh context.
 * @param source The worker's source.
 * @param name The constant's name.
 * @returns The constant's value, copied into this realm.
 */
const readConstant = (source: string, name: string): unknown => {
  const context = createContext({
    URL,
    self: { addEventListener: vi.fn(), location: { origin: 'https://example.com' } },
  });
  runInContext(source, context);
  return JSON.parse(runInContext(`JSON.stringify(${name})`, context) as string);
};

/**
 * Starts a dev server for the fixture app with the plugin.
 * @param config The plugin's config.
 * @returns A promise that resolves to the server's origin.
 */
const startServer = async (config: string | IServiceWorkerConfig): Promise<string> => {
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { port: 0, host: '127.0.0.1' },
    plugins: [serviceWorkerPlugin({ config })],
  });
  await server.listen();
  const { port } = server.httpServer?.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'jg-sw-plugin-'));
  await writeFile(
    join(root, 'index.html'),
    '<!doctype html><html><body><script type="module" src="/main.js"></script></body></html>',
  );
  await writeFile(join(root, 'main.js'), "document.body.append('fixture');\n");
  await writeFile(join(root, 'entry-server.js'), 'export const render = () => "fixture";\n');
  await writeFile(join(root, 'jg-sw.config.json'), JSON.stringify(CONFIG));
});

afterEach(async () => {
  await server?.close();
  server = undefined;
  await rm(root, { recursive: true, force: true });
});

describe('serviceWorkerPlugin', () => {
  test('writes the worker into outDir after a build, precaching the built files', async () => {
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [serviceWorkerPlugin({ config: 'jg-sw.config.json' })],
    });

    const source = await readFile(join(root, 'dist', 'sw.js'), 'utf8');
    const precacheAssets = readConstant(source, 'PRECACHE_ASSETS') as string[];
    expect(readConstant(source, 'CACHING')).toBe(true);
    expect(precacheAssets.slice(0, 2)).toStrictEqual(['/', '/index.html']);
    expect(precacheAssets.slice(2)).toHaveLength(1);
    expect(precacheAssets[2]).toMatch(/^\/assets\/index-[\w-]+\.js$/);
  });

  test('writes no worker for a server-side rendering build', async () => {
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      build: { ssr: 'entry-server.js', outDir: 'dist-server' },
      plugins: [serviceWorkerPlugin({ config: CONFIG })],
    });

    expect(await pathExists(join(root, 'dist-server', 'entry-server.mjs'))).toBe(true);
    expect(await pathExists(join(root, 'dist', 'sw.js'))).toBe(false);
    expect(await pathExists(join(root, 'dist-server', 'sw.js'))).toBe(false);
  });

  test('serves a worker without caching at /sw.js in development', async () => {
    const origin = await startServer('jg-sw.config.json');

    for (const path of ['/sw.js', '/sw.js?v=2']) {
      const response = await fetch(`${origin}${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      const source = await response.text();
      expect(readConstant(source, 'CACHING')).toBe(false);
      expect(readConstant(source, 'PRECACHE_ASSETS')).toStrictEqual([]);
    }

    // the dev server keeps serving the app itself
    const page = await fetch(`${origin}/`);
    expect(await page.text()).toContain('/main.js');
    expect(await pathExists(join(root, 'dist', 'sw.js'))).toBe(false);
  });

  test('re-reads the config file on every request in development', async () => {
    const origin = await startServer('jg-sw.config.json');
    const firstSource = await (await fetch(`${origin}/sw.js`)).text();
    await writeFile(
      join(root, 'jg-sw.config.json'),
      JSON.stringify({ ...CONFIG, cacheNamePrefix: 'renamed-app' }),
    );
    const secondSource = await (await fetch(`${origin}/sw.js`)).text();

    expect(readConstant(firstSource, 'CACHE_NAME_PREFIX')).toBe('fixture-app');
    expect(readConstant(secondSource, 'CACHE_NAME_PREFIX')).toBe('renamed-app');
  });

  test('answers with an error when the worker cannot be generated in development', async () => {
    const origin = await startServer('missing.config.json');

    const response = await fetch(`${origin}/sw.js`);

    expect(response.status).toBe(500);
  });
});
