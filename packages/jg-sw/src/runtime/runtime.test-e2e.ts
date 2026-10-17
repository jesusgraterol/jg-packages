import { expect, test, type Page } from '@playwright/test';

import { startFixtureServer, type IFixtureServer } from './fixture.test-utils.js';
import type * as runtime from './index.js';

// the fixture page's window, where it keeps the runtime and its registration
type IFixtureWindow = Window & {
  jgSw: typeof runtime;
  registration: ReturnType<typeof runtime.registerServiceWorker>;
};

// how long a reload loop gets to show itself
const SETTLE_MS = 2_000;

let server: IFixtureServer;

/**
 * Opens the app on its first visit and waits until the v1 worker controls the page.
 * @param page The page.
 */
const openApp = async (page: Page): Promise<void> => {
  await page.goto(server.origin);
  await page.evaluate(() => (window as unknown as IFixtureWindow).registration);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
};

/**
 * Reads how many times the page loaded in this tab, or -1 while it's reloading.
 * @param page The page.
 * @returns A promise that resolves to the count.
 */
const countLoads = async (page: Page): Promise<number> => {
  try {
    return await page.evaluate(() => Number(sessionStorage.getItem('loads')));
  } catch {
    return -1;
  }
};

/**
 * Waits for the page to load a given number of times, then for the runtime to be ready.
 * @param page The page.
 * @param loads The number of loads.
 */
const waitForLoads = async (page: Page, loads: number): Promise<void> => {
  await expect.poll(() => countLoads(page), { timeout: 15_000 }).toBe(loads);
  await page.waitForFunction(() => 'jgSw' in window);
};

/**
 * Reads the version the controlling worker's cache serves.
 * @param page The page.
 * @returns A promise that resolves to 'v1' or 'v2'.
 */
const readVersion = (page: Page): Promise<string> =>
  page.evaluate(async () => (await fetch('/version.txt')).text());

/**
 * Reads whether the snapshot reports a waiting worker.
 * @param page The page.
 * @returns A promise that resolves to hasWaitingWorker.
 */
const hasWaitingWorker = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => (window as unknown as IFixtureWindow).jgSw.getServiceWorkerSnapshot().hasWaitingWorker,
  );

/**
 * Makes the browser check for a new worker, as it does on navigations and periodically.
 * @param page The page.
 */
const checkForUpdate = async (page: Page): Promise<void> => {
  await page.evaluate(() =>
    (window as unknown as IFixtureWindow).jgSw.getServiceWorkerSnapshot().registration?.update(),
  );
};

/**
 * Calls updateApp without waiting for it, because the page may reload while it runs.
 * @param page The page.
 */
const startUpdate = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    void (window as unknown as IFixtureWindow).jgSw.updateApp();
  });
};

test.beforeEach(async () => {
  server = await startFixtureServer();
  await server.deploy('v1');
});

test.afterEach(async () => {
  await server.close();
});

test('registers v1, then sees v2 waiting once it is deployed', async ({ page }) => {
  await openApp(page);
  expect(await readVersion(page)).toBe('v1');
  expect(await hasWaitingWorker(page)).toBe(false);

  await server.deploy('v2');
  await checkForUpdate(page);

  await expect.poll(() => hasWaitingWorker(page)).toBe(true);
  expect(await readVersion(page)).toBe('v1');
});

test('updateApp() reloads exactly once and the new worker takes control', async ({ page }) => {
  await openApp(page);
  await server.deploy('v2');
  await checkForUpdate(page);
  await expect.poll(() => hasWaitingWorker(page)).toBe(true);

  await startUpdate(page);

  await waitForLoads(page, 2);
  expect(await readVersion(page)).toBe('v2');
  expect(await hasWaitingWorker(page)).toBe(false);
});

test('updateApp() before v2 is waiting waits for it to install, then reloads once into v2', async ({
  page,
}) => {
  await openApp(page);
  await server.deploy('v2', { installDelayMs: 1_500 });
  expect(await hasWaitingWorker(page)).toBe(false);

  await startUpdate(page);

  await waitForLoads(page, 2);
  expect(await readVersion(page)).toBe('v2');
  await page.waitForTimeout(SETTLE_MS);
  expect(await countLoads(page)).toBe(2);
});

test('a v2 whose install fails: one plain reload, and v1 still controls the page', async ({
  page,
}) => {
  await openApp(page);
  await server.deploy('v2', { failInstall: true });

  await startUpdate(page);

  await waitForLoads(page, 2);
  await page.waitForTimeout(SETTLE_MS);
  expect(await countLoads(page)).toBe(2);
  expect(await readVersion(page)).toBe('v1');
  expect(await hasWaitingWorker(page)).toBe(false);
});

test('never reloads in a loop: not when v1 claims the page, nor after the update', async ({
  page,
}) => {
  await openApp(page);
  await page.waitForTimeout(SETTLE_MS);
  expect(await countLoads(page)).toBe(1);

  await server.deploy('v2');
  await checkForUpdate(page);
  await expect.poll(() => hasWaitingWorker(page)).toBe(true);
  await startUpdate(page);
  await waitForLoads(page, 2);

  await page.waitForTimeout(SETTLE_MS);
  expect(await countLoads(page)).toBe(2);
});

test('never caches no-store responses', async ({ page }) => {
  await openApp(page);

  await page.evaluate(async () => {
    await fetch('/cacheable.txt');
    await fetch('/no-store.txt');
  });

  const findCached = (): Promise<{ cacheable: boolean; noStore: boolean }> =>
    page.evaluate(async () => {
      const found = { cacheable: false, noStore: false };
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        found.cacheable ||= (await cache.match('/cacheable.txt')) !== undefined;
        found.noStore ||= (await cache.match('/no-store.txt')) !== undefined;
      }
      return found;
    });
  await expect.poll(findCached).toStrictEqual({ cacheable: true, noStore: false });
  await page.waitForTimeout(500);
  expect(await findCached()).toStrictEqual({ cacheable: true, noStore: false });
});
