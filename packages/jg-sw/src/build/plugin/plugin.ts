import { resolve } from 'node:path';
import type { Plugin } from 'vite';

import { DEFAULT_SERVICE_WORKER_PATH } from '../../shared/index.js';
import { readServiceWorkerConfig, type IServiceWorkerConfig } from '../config/index.js';
import { buildServiceWorker, writeServiceWorker } from '../service-worker/index.js';
import type { IBuildServiceWorkerOptions } from '../shared/index.js';

/**
 * Reads the plugin's config: the file at the path, re-read on every call so edits apply, or the
 * object as it is.
 * @param config The config file's path, relative to the working directory, or the config.
 * @param cwd The working directory.
 * @returns A promise that resolves to the config.
 */
const loadConfig = (
  config: string | IServiceWorkerConfig,
  cwd: string,
): Promise<IServiceWorkerConfig> =>
  typeof config === 'string'
    ? readServiceWorkerConfig(resolve(cwd, config))
    : Promise.resolve(config);

/**
 * Creates a Vite plugin that generates the service worker. After a production build, it writes
 * `sw.js` into the config's outDir, once the client bundle is written. During development, the
 * dev server answers `/sw.js` with a worker generated with `caching: false`, so every request
 * reaches the dev server and updates show up without stale caches. Paths are resolved from Vite's
 * root unless `cwd` is set. When generating fails, the build fails with writeServiceWorker's
 * error, and the dev server answers the worker's request with it.
 * @param options The config, as a file path or an object, plus the build options. The dev server
 * uses the environment option, or `development` when it isn't set.
 * @returns The Vite plugin.
 * @example
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { serviceWorkerPlugin } from 'jg-sw/build';
 *
 * export default defineConfig({
 *   plugins: [serviceWorkerPlugin({ config: 'jg-sw.config.json', environment: 'production' })],
 * });
 */
export const serviceWorkerPlugin = ({
  config,
  ...options
}: { config: string | IServiceWorkerConfig } & IBuildServiceWorkerOptions): Plugin => {
  let root = process.cwd();
  return {
    name: 'jg-sw',
    configResolved(resolvedConfig) {
      root = resolvedConfig.root;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== DEFAULT_SERVICE_WORKER_PATH) {
          next();
          return;
        }
        const serveWorker = async (): Promise<void> => {
          try {
            const cwd = options.cwd ?? root;
            const source = await buildServiceWorker(await loadConfig(config, cwd), {
              environment: options.environment ?? 'development',
              cwd,
              caching: false,
            });
            response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
            response.setHeader('Cache-Control', 'no-cache');
            response.end(source);
          } catch (error) {
            next(error);
          }
        };
        void serveWorker();
      });
    },
    async closeBundle() {
      // a build with server-side rendering bundles the server too, which needs no worker
      if (this.environment.config.consumer !== 'client') {
        return;
      }
      const cwd = options.cwd ?? root;
      await writeServiceWorker(await loadConfig(config, cwd), { ...options, cwd });
    },
  };
};
