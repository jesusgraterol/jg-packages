import { type INestApplication, Logger } from '@nestjs/common';

import type { IListenHttpAppOptions } from './types.js';

/**
 * Starts an app listening, and closes it when it can't, such as when the port is taken, so its
 * shutdown hooks release what the modules opened, such as database pools, before the error reaches
 * the caller. A failure to close is logged, and the listen error is rethrown either way.
 * @param app The app, configured and ready to listen.
 * @param options The port, and the host to bind, which defaults to every interface.
 * @returns A promise that resolves once the app is listening.
 * @example
 * import { NestFactory } from '@nestjs/core';
 * import type { NestExpressApplication } from '@nestjs/platform-express';
 * import { configureHttpApp, listenHttpApp } from 'jg-nestjs';
 *
 * declare const AppModule: new () => object;
 *
 * const app = await NestFactory.create<NestExpressApplication>(AppModule);
 * configureHttpApp(app, { bodyLimit: '1mb' });
 * await listenHttpApp(app, { port: 3000, host: '127.0.0.1' });
 * @throws
 * - What `app.listen` rejects with, such as EADDRINUSE for a port in use.
 */
export const listenHttpApp = async (
  app: INestApplication,
  { port, host }: IListenHttpAppOptions,
): Promise<void> => {
  try {
    await (host === undefined ? app.listen(port) : app.listen(port, host));
  } catch (error) {
    try {
      await app.close();
    } catch (closeError) {
      new Logger('listenHttpApp').error(
        'The app failed to close after it failed to listen.',
        closeError,
      );
    }
    throw error;
  }
};
