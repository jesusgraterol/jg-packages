import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// a running Nest app and where to reach it
export type ITestHttpApp = {
  app: INestApplication;
  baseUrl: string;
  close: () => Promise<void>;
};

/**
 * Compiles a testing module, creates its HTTP app on Express, lets the test configure it, and
 * listens on a free local port. Nest's own startup logs are off; the Logger calls the package
 * makes still reach a spy on Logger.prototype.
 * @param metadata The module's controllers and providers.
 * @param configure Configures the app before it starts, such as enabling CORS.
 * @returns A promise that resolves to the app, its base URL, and a function that closes it.
 */
export const startHttpApp = async (
  metadata: ModuleMetadata,
  configure: (app: INestApplication) => void = () => undefined,
): Promise<ITestHttpApp> => {
  const module = await Test.createTestingModule(metadata).compile();
  const app = module.createNestApplication({ logger: false });
  configure(app);
  // the app's init runs the module's lifecycle once, and its close tears the module down
  await app.init();
  await app.listen(0, '127.0.0.1');
  return { app, baseUrl: await app.getUrl(), close: () => app.close() };
};

/**
 * Sends a request to the app and reads its JSON body.
 * @param url The URL.
 * @param init The request's options.
 * @returns A promise that resolves to the status, the headers, and the parsed body.
 */
export const requestJson = async (
  url: string,
  init?: RequestInit,
): Promise<{ status: number; headers: Headers; body: unknown }> => {
  const response = await fetch(url, init);
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text === '' ? undefined : (JSON.parse(text) as unknown),
  };
};
