import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { useBreakpoint } from './breakpoint/index.js';
import { useDocumentVisibility } from './document-visibility/index.js';
import { useOnlineStatus } from './online-status/index.js';
import { useIsWindowScrolledPast } from './window-scroll/index.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Overrides a read-only property of an object for one test, such as navigator.onLine.
 * @param target The object.
 * @param property The property.
 * @param read Reads the property's value.
 * @returns The function that restores the original property.
 */
const overrideGetter = (target: object, property: string, read: () => unknown): (() => void) => {
  Object.defineProperty(target, property, { configurable: true, get: read });
  return () => {
    Reflect.deleteProperty(target, property);
  };
};

describe('useOnlineStatus', () => {
  test('follows the browser going offline and back online', () => {
    let onLine = true;
    const restore = overrideGetter(navigator, 'onLine', () => onLine);
    try {
      const { result } = renderHook(() => useOnlineStatus());
      expect(result.current).toBe(true);

      act(() => {
        onLine = false;
        window.dispatchEvent(new Event('offline'));
      });
      expect(result.current).toBe(false);

      act(() => {
        onLine = true;
        window.dispatchEvent(new Event('online'));
      });
      expect(result.current).toBe(true);
    } finally {
      restore();
    }
  });
});

describe('useDocumentVisibility', () => {
  test('keeps one subscription across renders, follows changes, and releases it on unmount', () => {
    let visibilityState: DocumentVisibilityState = 'visible';
    const restore = overrideGetter(document, 'visibilityState', () => visibilityState);
    const addListener = vi.spyOn(document, 'addEventListener');
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const countVisibility = (spy: typeof addListener): number =>
      spy.mock.calls.filter(([name]) => name === 'visibilitychange').length;
    try {
      const { result, rerender, unmount } = renderHook(() => useDocumentVisibility());
      expect(result.current).toBe(true);
      rerender();
      expect(countVisibility(addListener)).toBe(1);

      act(() => {
        visibilityState = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current).toBe(false);

      unmount();
      expect(countVisibility(removeListener)).toBe(1);
    } finally {
      restore();
    }
  });

  test('renders visible on the server even when the host page is hidden', () => {
    const restore = overrideGetter(document, 'visibilityState', () => 'hidden');
    try {
      const Probe = () =>
        createElement('span', null, useDocumentVisibility() ? 'visible' : 'hidden');

      expect(renderToString(createElement(Probe))).toBe('<span>visible</span>');
    } finally {
      restore();
    }
  });
});

describe('useBreakpoint', () => {
  test('reads xs on a phone, follows resizes across breakpoints, and only re-renders on a crossing', async () => {
    await page.viewport(375, 800);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useBreakpoint();
    });
    expect(result.current).toBe('xs');

    await page.viewport(390, 800);
    await page.viewport(700, 800);
    await vi.waitFor(() => {
      expect(result.current).toBe('sm');
    });
    const rendersAtSm = renders;

    await page.viewport(720, 800);
    await page.viewport(1300, 800);
    await vi.waitFor(() => {
      expect(result.current).toBe('xl');
    });
    expect(renders).toBe(rendersAtSm + 1);
  });
});

describe('useIsWindowScrolledPast', () => {
  test('turns true past the threshold, and re-renders only when the answer changes', async () => {
    await page.viewport(800, 600);
    const spacer = document.createElement('div');
    spacer.style.height = '5000px';
    document.body.append(spacer);
    try {
      let renders = 0;
      const { result } = renderHook(() => {
        renders += 1;
        return useIsWindowScrolledPast(100);
      });
      expect(result.current).toBe(false);
      const initialRenders = renders;

      const scrollTo = async (top: number): Promise<void> => {
        await act(async () => {
          window.scrollTo(0, top);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        });
      };
      await scrollTo(50);
      expect(result.current).toBe(false);
      expect(renders).toBe(initialRenders);

      await scrollTo(200);
      await vi.waitFor(() => {
        expect(result.current).toBe(true);
      });
      const rendersPastThreshold = renders;

      await scrollTo(400);
      await scrollTo(900);
      expect(result.current).toBe(true);
      expect(renders).toBe(rendersPastThreshold);
    } finally {
      window.scrollTo(0, 0);
      spacer.remove();
    }
  });
});
