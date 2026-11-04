import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { useNewBuildAvailable } from './new-build.hook.js';

// the page's own entry script, inserted through innerHTML, which never runs a script
const CURRENT_ENTRY = '<script type="module" src="/assets/index-old.js"></script>';

/**
 * Builds the entry page a server answers with.
 * @param entry The entry script it loads, or none for a page that isn't the app.
 * @returns The page's HTML.
 */
const buildServedPage = (entry: string | null): string =>
  `<!doctype html><html><head>${entry === null ? '' : `<script type="module" src="${entry}"></script>`}</head><body></body></html>`;

/**
 * Stubs fetch with one that answers the entry page.
 * @param body The page's HTML.
 * @param init The answer's status and headers.
 * @returns The stub.
 */
const stubServedPage = (
  body: string,
  init: ResponseInit = { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
) => {
  const fetchStub = vi.fn(() => Promise.resolve(new Response(body, init)));
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
};

/**
 * Overrides a read-only property of an object for one test, such as navigator.onLine.
 * @param target The object.
 * @param property The property.
 * @param value The value it reads.
 */
const overrideGetter = (target: object, property: string, value: unknown): void => {
  Object.defineProperty(target, property, { configurable: true, get: () => value });
};

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  container.innerHTML = CURRENT_ENTRY;
  document.body.append(container);
});

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  container.remove();
  Reflect.deleteProperty(document, 'visibilityState');
  Reflect.deleteProperty(navigator, 'onLine');
  vi.unstubAllGlobals();
});

describe('useNewBuildAvailable', () => {
  test('tells a newer build from the entry page the server serves', async () => {
    const fetchStub = stubServedPage(buildServedPage('/assets/index-new.js'));
    const { result } = renderHook(() => useNewBuildAvailable());
    expect(result.current.isNewBuildAvailable).toBe(false);

    await act(() => result.current.check());

    expect(result.current.isNewBuildAvailable).toBe(true);
    expect(fetchStub).toHaveBeenCalledExactlyOnceWith('/', {
      cache: 'no-store',
      redirect: 'manual',
    });

    // once found, a check reads nothing more
    await act(() => result.current.check());
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['the same build', () => stubServedPage(buildServedPage('/assets/index-old.js'))],
    ['a page without the app, such as a sign-in page', () => stubServedPage(buildServedPage(null))],
    [
      'an answer that is not HTML',
      () =>
        stubServedPage(buildServedPage('/assets/index-new.js'), {
          headers: { 'Content-Type': 'application/json' },
        }),
    ],
    [
      'an answer without a content type',
      () => stubServedPage(buildServedPage('/assets/index-new.js'), { headers: {} }),
    ],
    [
      'a failed answer',
      () => stubServedPage(buildServedPage('/assets/index-new.js'), { status: 503 }),
    ],
    [
      'a read that fails',
      () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
        );
      },
    ],
  ])('says nothing for %s', async (_description, stub) => {
    stub();
    const { result } = renderHook(() => useNewBuildAvailable());

    await act(() => result.current.check());

    expect(result.current.isNewBuildAvailable).toBe(false);
  });

  test("reads nothing on a page that doesn't load a build's entry, such as a development server's", async () => {
    container.innerHTML = '<script type="module" src="/src/main.tsx"></script>';
    const fetchStub = stubServedPage(buildServedPage('/assets/index-new.js'));
    const { result } = renderHook(() => useNewBuildAvailable());

    await act(() => result.current.check());

    expect(fetchStub).not.toHaveBeenCalled();
    expect(result.current.isNewBuildAvailable).toBe(false);
  });

  test('reads the entry page and the asset folder it is given', async () => {
    container.innerHTML = '<script type="module" src="/app/static/main-1.js"></script>';
    const fetchStub = stubServedPage(buildServedPage('/app/static/main-2.js'));
    const { result } = renderHook(() =>
      useNewBuildAvailable({ entryPath: '/app/', assetPrefix: '/app/static/' }),
    );

    await act(() => result.current.check());

    expect(result.current.isNewBuildAvailable).toBe(true);
    expect(fetchStub).toHaveBeenCalledExactlyOnceWith('/app/', {
      cache: 'no-store',
      redirect: 'manual',
    });
  });

  test('checks each time the page becomes visible again, not while it is hidden', async () => {
    const fetchStub = stubServedPage(buildServedPage('/assets/index-new.js'));
    const { result } = renderHook(() => useNewBuildAvailable());

    overrideGetter(document, 'visibilityState', 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fetchStub).not.toHaveBeenCalled();

    overrideGetter(document, 'visibilityState', 'visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => {
      expect(result.current.isNewBuildAvailable).toBe(true);
    });
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  test("treats a lazy chunk that's gone as a new build while online, and not offline", () => {
    const { result, unmount } = renderHook(() => useNewBuildAvailable());

    overrideGetter(navigator, 'onLine', false);
    const offlineError = new Event('vite:preloadError', { cancelable: true });
    act(() => {
      window.dispatchEvent(offlineError);
    });
    expect(result.current.isNewBuildAvailable).toBe(false);
    expect(offlineError.defaultPrevented).toBe(false);

    overrideGetter(navigator, 'onLine', true);
    const onlineError = new Event('vite:preloadError', { cancelable: true });
    act(() => {
      window.dispatchEvent(onlineError);
    });
    expect(result.current.isNewBuildAvailable).toBe(true);
    expect(onlineError.defaultPrevented).toBe(true);

    // unmounting stops listening
    unmount();
    const laterError = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(laterError);
    expect(laterError.defaultPrevented).toBe(false);
  });
});
