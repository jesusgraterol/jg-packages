import { createContext, runInContext, Script } from 'node:vm';
import { describe, expect, test, vi } from 'vitest';

import { SKIP_WAITING_MESSAGE_TYPE } from '../../shared/index.js';
import type { IFirebaseOptions } from '../config/index.js';
import { renderServiceWorker, type IRenderServiceWorkerInput } from './worker.js';

// Firebase options used to verify the Firebase FCM template
const TEST_FIREBASE_OPTIONS: IFirebaseOptions = {
  apiKey: 'test-api-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
  storageBucket: 'test.firebasestorage.app',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:test-app',
};

// Firebase SDK version used by the Firebase FCM template tests
const FIREBASE_SDK_VERSION = '11.0.0';

// minimal extendable-event contract used to execute generated workers in isolation
type IServiceWorkerExtendableEvent = {
  waitUntil: (lifetimePromise: Promise<unknown>) => void;
};

// minimal fetch-event contract used to observe interception and response lifetimes
type IServiceWorkerFetchEvent = IServiceWorkerExtendableEvent & {
  request: Request;
  respondWith: (responsePromise: Promise<Response>) => void;
};

// minimal message-event contract used to observe the skip-waiting handler
type IServiceWorkerMessageEvent = IServiceWorkerExtendableEvent & {
  data: unknown;
};

type IServiceWorkerEventListener = (event: IServiceWorkerExtendableEvent) => void;

// controlled CacheStorage behavior used by the worker runtime
type ICacheStorageOptions = {
  deleteCache?: (cacheName: string) => Promise<boolean>;
  putInCache?: (cacheName: string, request: Request, response: Response) => Promise<void>;
};

// controlled generated-worker behavior used by individual tests
type IWorkerRuntimeOptions = {
  cacheName?: string;
  cacheNamePrefix?: string;
  cacheStorage?: ReturnType<typeof createCacheStorage>;
  caching?: boolean;
  claimClients?: () => Promise<void>;
  excludeMimeTypes?: string[];
  navigationFallback?: string;
  networkResponse?: Response;
  precacheAssets?: string[];
};

/**
 * Builds the input of a base worker.
 * @param input The fields to override.
 * @returns The complete input.
 */
const baseInput = (input: Partial<IRenderServiceWorkerInput> = {}): IRenderServiceWorkerInput => ({
  template: 'base',
  cacheNamePrefix: 'test-app',
  cacheName: 'test-app--version-a',
  precacheAssets: [],
  excludeMIMETypes: [],
  caching: true,
  navigationFallback: null,
  ...input,
});

/**
 * Builds the input of a Firebase FCM worker.
 * @param input The fields to override.
 * @returns The complete input.
 */
const firebaseInput = (input: Partial<IRenderServiceWorkerInput> = {}): IRenderServiceWorkerInput =>
  baseInput({
    template: 'firebase-fcm',
    firebase: { sdkVersion: FIREBASE_SDK_VERSION, options: TEST_FIREBASE_OPTIONS },
    ...input,
  });

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
    importScripts: vi.fn(),
    firebase: { initializeApp: vi.fn(), messaging: () => ({ onBackgroundMessage: vi.fn() }) },
  });
  runInContext(source, context);
  return JSON.parse(runInContext(`JSON.stringify(${name})`, context) as string);
};

/**
 * Converts a request or precache path into the absolute key used by the isolated CacheStorage.
 * @param request The request or asset path to normalize.
 * @returns The absolute cache key.
 */
const getRequestKey = (request: Request | string): string =>
  new URL(typeof request === 'string' ? request : request.url, 'https://example.com').href;

/**
 * Builds a shared in-memory CacheStorage implementation with observable operations.
 * @param options Optional controlled cache operation implementations.
 * @returns The CacheStorage implementation, records, and operation spies.
 */
const createCacheStorage = (options: ICacheStorageOptions = {}) => {
  const cacheRecords = new Map<string, Map<string, Response>>();

  const seedCache = (cacheName: string, entries: Record<string, Response> = {}): void => {
    cacheRecords.set(
      cacheName,
      new Map(
        Object.entries(entries).map(([request, response]) => [getRequestKey(request), response]),
      ),
    );
  };

  const cacheAddAll = vi.fn((cacheName: string, assetPaths: string[]): Promise<void> => {
    const records = cacheRecords.get(cacheName);
    if (!records) {
      return Promise.reject(new Error(`Cache '${cacheName}' was not opened.`));
    }

    assetPaths.forEach((assetPath) => {
      records.set(
        getRequestKey(assetPath),
        new Response(`${cacheName}:${assetPath}`, {
          headers: { 'Content-Type': 'text/plain' },
          status: 200,
        }),
      );
    });
    return Promise.resolve();
  });

  const cacheMatch = vi.fn((cacheName: string, request: Request): Promise<Response | undefined> =>
    Promise.resolve(cacheRecords.get(cacheName)?.get(getRequestKey(request))),
  );

  const cachePut = vi.fn(
    async (cacheName: string, request: Request, response: Response): Promise<void> => {
      if (options.putInCache) {
        await options.putInCache(cacheName, request, response);
        return;
      }

      cacheRecords.get(cacheName)?.set(getRequestKey(request), response);
    },
  );

  const cacheOpen = vi.fn((cacheName: string) => {
    if (!cacheRecords.has(cacheName)) {
      seedCache(cacheName);
    }

    return Promise.resolve({
      addAll: (assetPaths: string[]): Promise<void> => cacheAddAll(cacheName, assetPaths),
      match: (request: Request): Promise<Response | undefined> => cacheMatch(cacheName, request),
      put: (request: Request, response: Response): Promise<void> =>
        cachePut(cacheName, request, response),
    });
  });

  const cacheDelete = vi.fn(async (cacheName: string): Promise<boolean> => {
    if (options.deleteCache) {
      const wasDeleted = await options.deleteCache(cacheName);
      if (wasDeleted) {
        cacheRecords.delete(cacheName);
      }
      return wasDeleted;
    }

    return cacheRecords.delete(cacheName);
  });

  const cacheKeys = vi.fn((): Promise<string[]> => Promise.resolve([...cacheRecords.keys()]));
  const globalCacheMatch = vi.fn((): Promise<Response | undefined> => Promise.resolve(undefined));

  return {
    cacheAddAll,
    cacheDelete,
    cacheKeys,
    cacheMatch,
    cacheOpen,
    cachePut,
    cacheRecords,
    globalCacheMatch,
    seedCache,
    value: {
      delete: cacheDelete,
      keys: cacheKeys,
      match: globalCacheMatch,
      open: cacheOpen,
    },
  };
};

/**
 * Returns a registered generated-worker event listener.
 * @param eventListeners The registered listener map.
 * @param eventName The event name to retrieve.
 * @returns The registered event listener.
 */
const getEventListener = (
  eventListeners: Map<string, IServiceWorkerEventListener>,
  eventName: string,
): IServiceWorkerEventListener => {
  const listener = eventListeners.get(eventName);
  if (!listener) {
    throw new Error(`The generated worker did not register a '${eventName}' listener.`);
  }

  return listener;
};

/**
 * Executes a generated worker with controlled network, clients, and CacheStorage dependencies.
 * @param options The worker's inputs and runtime dependencies.
 * @returns The registered listeners and observable runtime dependencies.
 */
const createWorkerRuntime = async (options: IWorkerRuntimeOptions = {}) => {
  const cacheNamePrefix = options.cacheNamePrefix ?? 'test-app';
  const cacheName = options.cacheName ?? `${cacheNamePrefix}--version-a`;
  const cacheStorage = options.cacheStorage ?? createCacheStorage();
  const eventListeners = new Map<string, IServiceWorkerEventListener>();
  const clientsClaim = vi.fn(options.claimClients ?? (() => Promise.resolve()));
  const consoleError = vi.fn();
  const fetchRequest = vi.fn(() =>
    Promise.resolve(
      options.networkResponse ??
        new Response('network response', {
          headers: { 'Content-Type': 'text/javascript' },
          status: 200,
        }),
    ),
  );
  const skipWaiting = vi.fn(() => Promise.resolve());

  new Script(
    await renderServiceWorker(
      baseInput({
        cacheNamePrefix,
        cacheName,
        caching: options.caching ?? true,
        precacheAssets: options.precacheAssets ?? [],
        excludeMIMETypes: options.excludeMimeTypes ?? [],
        navigationFallback: options.navigationFallback ?? null,
      }),
    ),
  ).runInNewContext({
    URL,
    caches: cacheStorage.value,
    console: { error: consoleError },
    fetch: fetchRequest,
    Response,
    self: {
      addEventListener: (eventName: string, listener: IServiceWorkerEventListener): void => {
        eventListeners.set(eventName, listener);
      },
      clients: { claim: clientsClaim },
      location: { origin: 'https://example.com' },
      skipWaiting,
    },
  });

  return {
    activateListener: getEventListener(eventListeners, 'activate'),
    cacheName,
    cacheStorage,
    clientsClaim,
    consoleError,
    eventListeners,
    fetchRequest,
    installListener: getEventListener(eventListeners, 'install'),
    messageListener: getEventListener(eventListeners, 'message'),
    skipWaiting,
  };
};

/**
 * Returns the fetch listener of a worker that caches.
 * @param runtime The worker runtime.
 * @returns The fetch listener.
 */
const getFetchListener = (
  runtime: Awaited<ReturnType<typeof createWorkerRuntime>>,
): IServiceWorkerEventListener => getEventListener(runtime.eventListeners, 'fetch');

/**
 * Dispatches an install or activate event and returns its lifetime promise.
 * @param listener The generated worker event listener.
 * @returns The event lifetime promise, or undefined when the listener didn't extend it.
 */
const dispatchExtendableEvent = (
  listener: IServiceWorkerEventListener,
): Promise<unknown> | undefined => {
  let lifetimePromise: Promise<unknown> | undefined;

  listener({
    waitUntil: (pendingOperation): void => {
      lifetimePromise = pendingOperation;
    },
  });

  return lifetimePromise;
};

/**
 * Dispatches a message event and returns its lifetime promise.
 * @param listener The generated worker message listener.
 * @param data The message's data.
 * @returns The event lifetime promise, or undefined when the listener didn't extend it.
 */
const dispatchMessage = (
  listener: IServiceWorkerEventListener,
  data: unknown,
): Promise<unknown> | undefined => {
  let lifetimePromise: Promise<unknown> | undefined;
  const event: IServiceWorkerMessageEvent = {
    data,
    waitUntil: (pendingOperation): void => {
      lifetimePromise = pendingOperation;
    },
  };

  listener(event);

  return lifetimePromise;
};

/**
 * Dispatches a fetch event and captures whether and how the worker intercepted it.
 * @param fetchListener The generated worker fetch listener.
 * @param request The request dispatched to the listener.
 * @returns The response, lifetime, and respondWith observations.
 */
const dispatchFetch = (fetchListener: IServiceWorkerEventListener, request: Request) => {
  let responsePromise: Promise<Response> | undefined;
  let lifetimePromise: Promise<unknown> | undefined;
  const respondWith = vi.fn((pendingResponse: Promise<Response>): void => {
    responsePromise = pendingResponse;
  });
  const event: IServiceWorkerFetchEvent = {
    request,
    respondWith,
    waitUntil: (pendingOperation): void => {
      lifetimePromise = pendingOperation;
    },
  };

  fetchListener(event);

  return {
    getLifetimePromise: (): Promise<unknown> | undefined => lifetimePromise,
    respondWith,
    responsePromise,
  };
};

/**
 * Returns the response promise for a fetch event that must be intercepted.
 * @param responsePromise The possibly registered response promise.
 * @returns The registered response promise.
 */
const requireResponsePromise = (
  responsePromise: Promise<Response> | undefined,
): Promise<Response> => {
  if (!responsePromise) {
    throw new Error('The generated worker did not respond to an eligible fetch event.');
  }

  return responsePromise;
};

/**
 * Returns the lifetime promise of an event the worker must extend.
 * @param lifetimePromise The possibly registered lifetime promise.
 * @returns The registered lifetime promise.
 */
const requireLifetimePromise = (
  lifetimePromise: Promise<unknown> | undefined,
): Promise<unknown> => {
  if (!lifetimePromise) {
    throw new Error('The generated worker did not extend the event lifetime.');
  }

  return lifetimePromise;
};

/**
 * Fetches a request through a caching worker and reports whether the response was cached.
 * @param networkResponse The response the network returns.
 * @param excludeMimeTypes MIME types excluded by the generated worker.
 * @returns A promise that resolves to whether the worker wrote the response to its cache.
 */
const isResponseCached = async (
  networkResponse: Response,
  excludeMimeTypes: string[] = [],
): Promise<boolean> => {
  const runtime = await createWorkerRuntime({ excludeMimeTypes, networkResponse });
  const request = new Request('https://example.com/app.js', {
    headers: { Accept: 'text/javascript' },
  });
  const pendingFetch = dispatchFetch(getFetchListener(runtime), request);

  await expect(requireResponsePromise(pendingFetch.responsePromise)).resolves.toBe(networkResponse);
  await expect(requireLifetimePromise(pendingFetch.getLifetimePromise())).resolves.toBeUndefined();
  return runtime.cacheStorage.cachePut.mock.calls.length > 0;
};

describe('renderServiceWorker', () => {
  test('can build a base template', async () => {
    const source = await renderServiceWorker(baseInput());

    expect(source.startsWith('// Generated by jg-sw.')).toBe(true);
    expect(readConstant(source, 'CACHE_NAME_PREFIX')).toBe('test-app');
    expect(readConstant(source, 'CACHE_NAME')).toBe('test-app--version-a');
    expect(readConstant(source, 'PRECACHE_ASSETS')).toStrictEqual([]);
    expect(readConstant(source, 'EXCLUDE_MIME_TYPES')).toStrictEqual([]);
    expect(readConstant(source, 'SKIP_WAITING_MESSAGE_TYPE')).toBe(SKIP_WAITING_MESSAGE_TYPE);
    expect(readConstant(source, 'CACHING')).toBe(true);
    expect(readConstant(source, 'NAVIGATION_FALLBACK')).toBeNull();
    expect(source).not.toContain('FIREBASE');
  });

  test('writes the navigation fallback into the worker', async () => {
    const source = await renderServiceWorker(baseInput({ navigationFallback: '/index.html' }));

    expect(readConstant(source, 'NAVIGATION_FALLBACK')).toBe('/index.html');
  });

  test('can build a base template with precache assets and excluded MIME types', async () => {
    const source = await renderServiceWorker(
      baseInput({
        precacheAssets: ['/', '/assets/', '/assets/bundle.js', '/index.html'],
        excludeMIMETypes: ['application/json', 'text/plain'],
      }),
    );

    expect(readConstant(source, 'PRECACHE_ASSETS')).toStrictEqual([
      '/',
      '/assets/',
      '/assets/bundle.js',
      '/index.html',
    ]);
    expect(readConstant(source, 'EXCLUDE_MIME_TYPES')).toStrictEqual([
      'application/json',
      'text/plain',
    ]);
  });

  test('escapes the paths it writes into the worker', async () => {
    const paths = ["/it's.js", '/a"b.js', "/$'tail.js", '/back\\slash.js', '/line\u2028sep.js'];
    const source = await renderServiceWorker(baseInput({ precacheAssets: paths }));

    expect(readConstant(source, 'PRECACHE_ASSETS')).toStrictEqual(paths);
    expect(() => new Script(source)).not.toThrow();
  });

  test('can build a Firebase FCM template appended to the base template', async () => {
    const source = await renderServiceWorker(
      firebaseInput({
        precacheAssets: ['/', '/assets/bundle.js', '/index.html'],
        excludeMIMETypes: ['application/json', 'text/plain'],
      }),
    );
    const baseSource = await renderServiceWorker(
      baseInput({
        precacheAssets: ['/', '/assets/bundle.js', '/index.html'],
        excludeMIMETypes: ['application/json', 'text/plain'],
      }),
    );

    expect(source.startsWith(baseSource.trimEnd())).toBe(true);
    expect(source).toContain(`\n\n/* global firebase */`);
    expect(readConstant(source, 'FIREBASE_SDK_VERSION')).toBe(FIREBASE_SDK_VERSION);
    expect(readConstant(source, 'FIREBASE_OPTIONS')).toStrictEqual(TEST_FIREBASE_OPTIONS);
    expect(readConstant(source, 'PRECACHE_ASSETS')).toStrictEqual([
      '/',
      '/assets/bundle.js',
      '/index.html',
    ]);

    // the worker loads the configured SDK version and initializes the app with the options
    const importScripts = vi.fn();
    const initializeApp = vi.fn();
    new Script(source).runInNewContext({
      URL,
      self: { addEventListener: vi.fn(), location: { origin: 'https://example.com' } },
      importScripts,
      firebase: { initializeApp, messaging: () => ({ onBackgroundMessage: vi.fn() }) },
    });
    expect(importScripts.mock.calls).toStrictEqual([
      [`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`],
      [`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`],
    ]);
    expect(JSON.stringify(initializeApp.mock.calls)).toBe(
      JSON.stringify([[TEST_FIREBASE_OPTIONS]]),
    );
  });

  test('shows a background notification even when a hidden app window exists', async () => {
    const source = await renderServiceWorker(firebaseInput());
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const matchAll = vi
      .fn()
      .mockResolvedValue([{ url: 'https://cloud.example.com/', visibilityState: 'hidden' }]);
    let onBackgroundMessage:
      | ((payload: {
          data: Record<string, string>;
          notification?: { title: string };
        }) => Promise<void>)
      | undefined;
    const self = {
      location: { origin: 'https://cloud.example.com' },
      registration: { showNotification },
      addEventListener: vi.fn(),
    };
    new Script(source).runInNewContext({
      self,
      clients: { matchAll, openWindow: vi.fn() },
      firebase: {
        initializeApp: vi.fn(),
        messaging: () => ({
          onBackgroundMessage: (callback: typeof onBackgroundMessage) => {
            onBackgroundMessage = callback;
          },
        }),
      },
      importScripts: vi.fn(),
      URL,
    });

    await onBackgroundMessage?.({
      data: { title: 'Account update', body: 'A detail', url: '/notifications' },
    });
    expect(showNotification).toHaveBeenCalledOnce();
    expect(showNotification).toHaveBeenCalledWith('Account update', {
      body: 'A detail',
      icon: undefined,
      badge: undefined,
      data: {
        title: 'Account update',
        body: 'A detail',
        url: 'https://cloud.example.com/notifications',
      },
    });
    await onBackgroundMessage?.({
      data: { title: 'Account update', body: 'A detail', url: '/notifications' },
      notification: { title: 'Already displayed by Firebase' },
    });
    expect(showNotification).toHaveBeenCalledOnce();
    expect(matchAll).not.toHaveBeenCalled();
  });

  test('awaits the jgSwFcmBackgroundMessageHandler hook without showing another notification', async () => {
    const source = await renderServiceWorker(firebaseInput());
    let onBackgroundMessage:
      ((payload: { data: Record<string, string> }) => Promise<void>) | undefined;
    const self = {
      location: { origin: 'https://cloud.example.com' },
      registration: { showNotification: vi.fn() },
      addEventListener: vi.fn(),
      jgSwFcmBackgroundMessageHandler: undefined as
        undefined | ((payload: { data: Record<string, string> }) => Promise<void>),
    };
    new Script(source).runInNewContext({
      self,
      clients: { matchAll: vi.fn(), openWindow: vi.fn() },
      firebase: {
        initializeApp: vi.fn(),
        messaging: () => ({
          onBackgroundMessage: (callback: typeof onBackgroundMessage) => {
            onBackgroundMessage = callback;
          },
        }),
      },
      importScripts: vi.fn(),
      URL,
    });
    let complete!: () => void;
    const completion = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const handler = vi.fn(() => completion);
    self.jgSwFcmBackgroundMessageHandler = handler;
    if (!onBackgroundMessage) throw new Error('Missing background callback.');
    const payload = { data: { title: 'Account update', body: 'A detail' } };
    const callbackPromise = onBackgroundMessage(payload);
    let didSettle = false;
    const observedLifetime = callbackPromise.then(() => {
      didSettle = true;
    });
    expect(handler).toHaveBeenCalledWith(payload);
    expect(didSettle).toBe(false);
    complete();
    await observedLifetime;
    expect(didSettle).toBe(true);
    expect(self.registration.showNotification).not.toHaveBeenCalled();
  });
});

describe('Base template lifecycle', () => {
  test('install populates only the new cache without deleting caches or skipping waiting', async () => {
    const cacheStorage = createCacheStorage();
    cacheStorage.seedCache('test-app--version-a');
    const runtime = await createWorkerRuntime({
      cacheName: 'test-app--version-b',
      cacheStorage,
      precacheAssets: ['/app.js'],
    });

    await expect(
      requireLifetimePromise(dispatchExtendableEvent(runtime.installListener)),
    ).resolves.toBeUndefined();

    expect(cacheStorage.cacheAddAll).toHaveBeenCalledWith('test-app--version-b', ['/app.js']);
    expect(cacheStorage.cacheDelete).not.toHaveBeenCalled();
    expect(cacheStorage.cacheRecords.has('test-app--version-a')).toBe(true);
    expect(cacheStorage.cacheRecords.has('test-app--version-b')).toBe(true);
    expect(runtime.skipWaiting).not.toHaveBeenCalled();
  });

  test('the active worker keeps serving its cache while the next worker is installed', async () => {
    const cacheStorage = createCacheStorage();
    const workerA = await createWorkerRuntime({
      cacheName: 'test-app--version-a',
      cacheStorage,
      precacheAssets: ['/app.js'],
    });
    const workerB = await createWorkerRuntime({
      cacheName: 'test-app--version-b',
      cacheStorage,
      precacheAssets: ['/app.js'],
    });

    await dispatchExtendableEvent(workerA.installListener);
    await dispatchExtendableEvent(workerB.installListener);

    const pendingFetch = dispatchFetch(
      getFetchListener(workerA),
      new Request('https://example.com/app.js'),
    );
    const response = await requireResponsePromise(pendingFetch.responsePromise);

    await expect(response.text()).resolves.toBe('test-app--version-a:/app.js');
    expect(workerA.fetchRequest).not.toHaveBeenCalled();
    expect(cacheStorage.cacheDelete).not.toHaveBeenCalled();
    expect(cacheStorage.cacheRecords.has('test-app--version-a')).toBe(true);
    expect(cacheStorage.cacheRecords.has('test-app--version-b')).toBe(true);
  });

  test('activate deletes only older caches in the namespace before claiming clients', async () => {
    let resolveCacheDeletion: ((wasDeleted: boolean) => void) | undefined;
    const cacheDeletionPromise = new Promise<boolean>((resolve) => {
      resolveCacheDeletion = resolve;
    });
    const cacheStorage = createCacheStorage({
      deleteCache: () => cacheDeletionPromise,
    });
    cacheStorage.seedCache('test-app--version-a');
    cacheStorage.seedCache('test-app--version-b');
    cacheStorage.seedCache('test-app-other--version-a');
    cacheStorage.seedCache('other-app--version-a');
    cacheStorage.seedCache('legacyrandom');
    const runtime = await createWorkerRuntime({
      cacheName: 'test-app--version-b',
      cacheStorage,
    });

    const activationPromise = requireLifetimePromise(
      dispatchExtendableEvent(runtime.activateListener),
    );
    await vi.waitFor(() => {
      expect(cacheStorage.cacheDelete).toHaveBeenCalledWith('test-app--version-a');
    });

    expect(runtime.clientsClaim).not.toHaveBeenCalled();
    expect(cacheStorage.cacheDelete).toHaveBeenCalledTimes(1);

    if (!resolveCacheDeletion) {
      throw new Error('The controlled cache deletion was not initialized.');
    }

    resolveCacheDeletion(true);
    await expect(activationPromise).resolves.toBeUndefined();

    expect(runtime.clientsClaim).toHaveBeenCalledOnce();
    expect(cacheStorage.cacheRecords.has('test-app--version-a')).toBe(false);
    expect(cacheStorage.cacheRecords.has('test-app--version-b')).toBe(true);
    expect(cacheStorage.cacheRecords.has('test-app-other--version-a')).toBe(true);
    expect(cacheStorage.cacheRecords.has('other-app--version-a')).toBe(true);
    expect(cacheStorage.cacheRecords.has('legacyrandom')).toBe(true);
  });

  test('the skip-waiting message activates the worker, and other messages are ignored', async () => {
    const runtime = await createWorkerRuntime();

    for (const data of [null, undefined, 'JG_SW_SKIP_WAITING', { type: 'OTHER' }, {}]) {
      expect(dispatchMessage(runtime.messageListener, data)).toBeUndefined();
    }
    expect(runtime.skipWaiting).not.toHaveBeenCalled();

    await expect(
      requireLifetimePromise(
        dispatchMessage(runtime.messageListener, { type: SKIP_WAITING_MESSAGE_TYPE }),
      ),
    ).resolves.toBeUndefined();
    expect(runtime.skipWaiting).toHaveBeenCalledOnce();
  });
});

describe('Base template without caching', () => {
  test('precaches nothing, keeps older caches, and handles no fetch events', async () => {
    const cacheStorage = createCacheStorage();
    cacheStorage.seedCache('test-app--version-a');
    const runtime = await createWorkerRuntime({
      caching: false,
      cacheName: 'test-app--version-b',
      cacheStorage,
      precacheAssets: ['/app.js'],
    });

    expect(runtime.eventListeners.has('fetch')).toBe(false);
    expect(dispatchExtendableEvent(runtime.installListener)).toBeUndefined();
    await expect(
      requireLifetimePromise(dispatchExtendableEvent(runtime.activateListener)),
    ).resolves.toBeUndefined();

    expect(runtime.clientsClaim).toHaveBeenCalledOnce();
    expect(cacheStorage.cacheOpen).not.toHaveBeenCalled();
    expect(cacheStorage.cacheKeys).not.toHaveBeenCalled();
    expect(cacheStorage.cacheRecords.has('test-app--version-a')).toBe(true);
  });

  test('keeps the skip-waiting message handler', async () => {
    const runtime = await createWorkerRuntime({ caching: false });

    await requireLifetimePromise(
      dispatchMessage(runtime.messageListener, { type: SKIP_WAITING_MESSAGE_TYPE }),
    );
    expect(runtime.skipWaiting).toHaveBeenCalledOnce();
  });

  test('keeps the Firebase FCM handlers', async () => {
    const source = await renderServiceWorker(firebaseInput({ caching: false }));
    const eventNames: string[] = [];
    const onBackgroundMessage = vi.fn();
    new Script(source).runInNewContext({
      URL,
      self: {
        addEventListener: (eventName: string) => eventNames.push(eventName),
        location: { origin: 'https://example.com' },
      },
      importScripts: vi.fn(),
      firebase: { initializeApp: vi.fn(), messaging: () => ({ onBackgroundMessage }) },
    });

    expect(eventNames.sort()).toStrictEqual([
      'activate',
      'install',
      'message',
      'notificationclick',
    ]);
    expect(onBackgroundMessage).toHaveBeenCalledOnce();
  });
});

describe('Base template fetch interception', () => {
  test('handles same-origin GET requests using only the opened current cache', async () => {
    const cachedResponse = new Response('cached response');
    const cacheStorage = createCacheStorage();
    cacheStorage.seedCache('test-app--version-a', {
      '/app.js': cachedResponse,
    });
    const runtime = await createWorkerRuntime({ cacheStorage });
    const request = new Request('https://example.com/app.js');
    const pendingFetch = dispatchFetch(getFetchListener(runtime), request);

    await expect(requireResponsePromise(pendingFetch.responsePromise)).resolves.toBe(
      cachedResponse,
    );
    expect(pendingFetch.respondWith).toHaveBeenCalledOnce();
    expect(cacheStorage.cacheOpen).toHaveBeenCalledWith('test-app--version-a');
    expect(cacheStorage.cacheMatch).toHaveBeenCalledWith('test-app--version-a', request);
    expect(cacheStorage.globalCacheMatch).not.toHaveBeenCalled();
    expect(runtime.fetchRequest).not.toHaveBeenCalled();
  });

  test.each([
    ['POST request', new Request('https://example.com/app.js', { method: 'POST' })],
    ['cross-origin GET request', new Request('https://cdn.example.net/app.js')],
  ])('does not intercept a %s', async (_description, request) => {
    const runtime = await createWorkerRuntime();
    const pendingFetch = dispatchFetch(getFetchListener(runtime), request);

    expect(pendingFetch.respondWith).not.toHaveBeenCalled();
    expect(pendingFetch.responsePromise).toBeUndefined();
    expect(runtime.cacheStorage.cacheOpen).not.toHaveBeenCalled();
    expect(runtime.fetchRequest).not.toHaveBeenCalled();
  });

  test('answers with a 408 response when the network fails', async () => {
    const runtime = await createWorkerRuntime();
    runtime.fetchRequest.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const pendingFetch = dispatchFetch(
      getFetchListener(runtime),
      new Request('https://example.com/app.js'),
    );

    const response = await requireResponsePromise(pendingFetch.responsePromise);
    expect(response.status).toBe(408);
    expect(runtime.cacheStorage.cachePut).not.toHaveBeenCalled();
  });
});

describe('Base template navigation fallback', () => {
  /**
   * Builds a navigation request, which a Request can't be constructed as.
   * @param path The page's path.
   * @returns The request.
   */
  const navigation = (path: string): Request =>
    ({
      url: `https://example.com${path}`,
      method: 'GET',
      mode: 'navigate',
      headers: new Headers(),
    }) as Request;

  /**
   * Builds a worker whose network fails, with the fallback page cached.
   * @param navigationFallback The worker's navigation fallback, if any.
   * @returns The worker runtime.
   */
  const createOfflineRuntime = async (navigationFallback?: string) => {
    const cacheStorage = createCacheStorage();
    cacheStorage.seedCache('test-app--version-a', {
      '/index.html': new Response('the app', { headers: { 'Content-Type': 'text/html' } }),
    });
    const runtime = await createWorkerRuntime({
      cacheStorage,
      ...(navigationFallback === undefined ? {} : { navigationFallback }),
    });
    runtime.fetchRequest.mockRejectedValue(new TypeError('Failed to fetch'));
    return runtime;
  };

  test('answers a navigation the network fails with the cached fallback page', async () => {
    const runtime = await createOfflineRuntime('/index.html');
    const pendingFetch = dispatchFetch(getFetchListener(runtime), navigation('/settings'));

    const response = await requireResponsePromise(pendingFetch.responsePromise);
    expect(await response.text()).toBe('the app');
  });

  test('keeps the 408 for other requests, without a fallback, and when it is not cached', async () => {
    const withFallback = await createOfflineRuntime('/index.html');
    const asset = dispatchFetch(
      getFetchListener(withFallback),
      new Request('https://example.com/app.js'),
    );
    expect((await requireResponsePromise(asset.responsePromise)).status).toBe(408);

    const withoutFallback = await createOfflineRuntime();
    const page = dispatchFetch(getFetchListener(withoutFallback), navigation('/settings'));
    expect((await requireResponsePromise(page.responsePromise)).status).toBe(408);

    const uncached = await createOfflineRuntime('/shell.html');
    const shell = dispatchFetch(getFetchListener(uncached), navigation('/settings'));
    expect((await requireResponsePromise(shell.responsePromise)).status).toBe(408);
  });
});

describe('Base template runtime cache writes', () => {
  test('returns a successful network response while extending the cache-write lifetime', async () => {
    let resolveCacheWrite: (() => void) | undefined;
    const cacheWritePromise = new Promise<void>((resolve) => {
      resolveCacheWrite = resolve;
    });
    const networkResponse = new Response('app', {
      headers: { 'Content-Type': 'text/javascript' },
      status: 200,
    });
    const cacheStorage = createCacheStorage({ putInCache: () => cacheWritePromise });
    const runtime = await createWorkerRuntime({ cacheStorage, networkResponse });
    const pendingFetch = dispatchFetch(
      getFetchListener(runtime),
      new Request('https://example.com/app.js', {
        headers: { Accept: 'text/javascript' },
      }),
    );

    await expect(requireResponsePromise(pendingFetch.responsePromise)).resolves.toBe(
      networkResponse,
    );
    expect(cacheStorage.cachePut).toHaveBeenCalledOnce();

    const lifetimePromise = requireLifetimePromise(pendingFetch.getLifetimePromise());
    if (!resolveCacheWrite) {
      throw new Error('The controlled cache write was not initialized.');
    }

    resolveCacheWrite();
    await expect(lifetimePromise).resolves.toBeUndefined();
  });

  test('returns a successful network response when the cache write fails', async () => {
    const cacheError = new Error('Cache storage unavailable.');
    const networkResponse = new Response('app', {
      headers: { 'Content-Type': 'text/javascript' },
      status: 200,
    });
    const cacheStorage = createCacheStorage({
      putInCache: () => Promise.reject(cacheError),
    });
    const runtime = await createWorkerRuntime({ cacheStorage, networkResponse });
    const pendingFetch = dispatchFetch(
      getFetchListener(runtime),
      new Request('https://example.com/app.js', {
        headers: { Accept: 'text/javascript' },
      }),
    );

    await expect(requireResponsePromise(pendingFetch.responsePromise)).resolves.toBe(
      networkResponse,
    );
    await expect(
      requireLifetimePromise(pendingFetch.getLifetimePromise()),
    ).resolves.toBeUndefined();
    expect(runtime.consoleError).toHaveBeenCalledWith(
      'Failed to cache the network response.',
      cacheError,
    );
  });

  test('caches a successful, cacheable network response', async () => {
    expect(
      await isResponseCached(
        new Response('app', {
          headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=60' },
          status: 200,
        }),
      ),
    ).toBe(true);
  });

  test('does not cache an unsuccessful network response', async () => {
    expect(
      await isResponseCached(
        new Response('Not found', {
          headers: { 'Content-Type': 'text/plain' },
          status: 404,
        }),
      ),
    ).toBe(false);
  });

  test('does not cache an opaque network response', async () => {
    const opaqueResponse = new Response(null, { status: 200 });
    const cloneOpaqueResponse = opaqueResponse.clone.bind(opaqueResponse);
    Object.defineProperty(opaqueResponse, 'type', { value: 'opaque' });
    Object.defineProperty(opaqueResponse, 'clone', {
      value: (): Response => {
        const clonedResponse = cloneOpaqueResponse();
        Object.defineProperty(clonedResponse, 'type', { value: 'opaque' });
        return clonedResponse;
      },
    });

    expect(await isResponseCached(opaqueResponse)).toBe(false);
  });

  test('does not cache a Partial Content network response', async () => {
    expect(
      await isResponseCached(
        new Response('Partial content', {
          headers: { 'Content-Type': 'text/plain' },
          status: 206,
        }),
      ),
    ).toBe(false);
  });

  test('does not cache a network response that varies on every request header', async () => {
    expect(
      await isResponseCached(
        new Response('app', {
          headers: { 'Content-Type': 'text/javascript', Vary: 'Accept-Encoding, *' },
          status: 200,
        }),
      ),
    ).toBe(false);
  });

  test.each([
    'no-store',
    'No-Store',
    'max-age=0, no-store',
    'private',
    'private="Set-Cookie", max-age=60',
  ])('does not cache a network response with Cache-Control: %s', async (cacheControl) => {
    expect(
      await isResponseCached(
        new Response('app', {
          headers: { 'Content-Type': 'text/javascript', 'Cache-Control': cacheControl },
          status: 200,
        }),
      ),
    ).toBe(false);
  });

  test('does not cache a response with an excluded MIME type', async () => {
    expect(
      await isResponseCached(
        new Response('{}', {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
        ['application/json'],
      ),
    ).toBe(false);
  });
});
