import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { useDocumentTheme } from './document-theme.hook.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  document.documentElement.classList.remove('light', 'dark', 'is-scrolled');
  vi.restoreAllMocks();
});

/**
 * Stubs the system's dark color scheme query with one the test controls.
 * @param matches Whether the system starts dark.
 * @returns The function that changes the system's color scheme.
 */
const stubSystemScheme = (matches: boolean): ((isDark: boolean) => void) => {
  const query = Object.assign(new EventTarget(), {
    matches,
    media: '(prefers-color-scheme: dark)',
  });
  vi.spyOn(window, 'matchMedia').mockReturnValue(query as unknown as MediaQueryList);
  return (isDark) => {
    query.matches = isDark;
    query.dispatchEvent(new Event('change'));
  };
};

/**
 * Waits long enough for a MutationObserver's callback to run.
 * @returns A promise that resolves after it.
 */
const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 20);
  });

describe('useDocumentTheme', () => {
  test("re-renders once when <html>'s theme class changes, and not for another class", async () => {
    stubSystemScheme(false);
    document.documentElement.classList.add('light');
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useDocumentTheme();
    });
    expect(result.current).toBe('light');
    const rendersBefore = renderCount;

    document.documentElement.classList.replace('light', 'dark');
    await vi.waitFor(() => {
      expect(result.current).toBe('dark');
    });
    expect(renderCount).toBe(rendersBefore + 1);

    document.documentElement.classList.add('is-scrolled');
    await settle();
    expect(renderCount).toBe(rendersBefore + 1);
  });

  test('lets dark win when both classes are present', () => {
    stubSystemScheme(false);
    document.documentElement.classList.add('light', 'dark');

    const { result } = renderHook(() => useDocumentTheme());

    expect(result.current).toBe('dark');
  });

  test("follows the system's color scheme while <html> has no theme class", async () => {
    const setSystemDark = stubSystemScheme(true);
    const { result } = renderHook(() => useDocumentTheme());
    expect(result.current).toBe('dark');

    setSystemDark(false);
    await vi.waitFor(() => {
      expect(result.current).toBe('light');
    });
  });
});
