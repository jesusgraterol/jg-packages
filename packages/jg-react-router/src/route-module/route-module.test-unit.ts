import { hasErrorCode } from 'jg-exception';
import { expectToRejectCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { createLazyRoute, loadRouteModule } from './route-module.js';

// what a browser rejects the import of a script that a newer build replaced with
const MISSING_SCRIPT = new TypeError(
  'Failed to fetch dynamically imported module: /assets/settings-old.js',
);

const SettingsPage = () => null;

describe('loadRouteModule', () => {
  test('resolves to the module the import loads', async () => {
    const module = { SettingsPage };

    await expect(loadRouteModule(() => Promise.resolve(module))).resolves.toBe(module);
  });

  test("rejects a failed import as the page's code being unavailable, keeping why", async () => {
    const loading = loadRouteModule(() => Promise.reject(MISSING_SCRIPT));

    await expectToRejectCode(
      loading,
      ERRORS.ROUTE_MODULE_UNAVAILABLE,
      "The page's code couldn't be loaded.",
    );
    const error: unknown = await loading.catch((reason: unknown) => reason);
    expect(error).toMatchObject({ cause: MISSING_SCRIPT, severity: 'expected' });
  });

  test("rejects an import that resolves with no module, as Vite's does once its preload error is prevented", async () => {
    const loading = loadRouteModule(() =>
      Promise.resolve(undefined as unknown as { SettingsPage: () => null }),
    );

    await expectToRejectCode(loading, ERRORS.ROUTE_MODULE_UNAVAILABLE);
    const error: unknown = await loading.catch((reason: unknown) => reason);
    expect(error instanceof Error && 'cause' in error).toBe(false);
  });

  test('rejects an import that throws before it returns a promise', async () => {
    await expectToRejectCode(
      loadRouteModule(() => {
        throw MISSING_SCRIPT;
      }),
      ERRORS.ROUTE_MODULE_UNAVAILABLE,
    );
  });
});

describe('createLazyRoute', () => {
  test('resolves to the component the module exports by name', async () => {
    const lazy = createLazyRoute(
      () => Promise.resolve({ SettingsPage }),
      (module) => module.SettingsPage,
    );

    await expect(lazy()).resolves.toStrictEqual({ Component: SettingsPage });
  });

  test('rejects a failed import with ROUTE_MODULE_UNAVAILABLE, without picking a component', async () => {
    const select = vi.fn((module: { SettingsPage: () => null }) => module.SettingsPage);
    const lazy = createLazyRoute(() => Promise.reject(MISSING_SCRIPT), select);

    const error: unknown = await lazy().catch((reason: unknown) => reason);

    expect(hasErrorCode(error, ERRORS.ROUTE_MODULE_UNAVAILABLE)).toBe(true);
    expect(select).not.toHaveBeenCalled();
  });
});
