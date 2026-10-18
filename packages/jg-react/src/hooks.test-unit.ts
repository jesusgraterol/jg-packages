import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { useBreakpoint } from './breakpoint/index.js';
import {
  getBreakpointFromWidth,
  getBreakpointSnapshot,
  isBreakpointAtLeast,
  subscribeToBreakpoint,
} from './breakpoint/utilities.js';
import { useDocumentVisibility } from './document-visibility/index.js';
import { getVisibilitySnapshot, subscribeToVisibility } from './document-visibility/utilities.js';
import { useOnlineStatus } from './online-status/index.js';
import { getOnlineSnapshot, subscribeToOnlineStatus } from './online-status/utilities.js';
import { useIsWindowScrolledPast } from './window-scroll/index.js';
import { getScrollY, subscribeToScroll } from './window-scroll/utilities.js';

/**
 * Builds an event target that records its listeners, standing in for window or a media query.
 * @param fields What else the stand-in holds, such as innerWidth or matches.
 * @returns The stand-in.
 */
const createTarget = <T extends object>(fields: T) => ({
  ...fields,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('in a server render', () => {
  test('every hook renders its server snapshot, with no window to read', () => {
    const Probe = () =>
      createElement(
        'p',
        null,
        JSON.stringify([
          useOnlineStatus(),
          useDocumentVisibility(),
          useBreakpoint() ?? 'unknown',
          useIsWindowScrolledPast(10),
        ]),
      );

    expect(renderToString(createElement(Probe))).toBe(
      '<p>[true,true,&quot;unknown&quot;,false]</p>',
    );
  });

  test('the snapshots and subscriptions work without a window, a document, or a navigator', () => {
    const notify = vi.fn();

    expect(getOnlineSnapshot()).toBe(true);
    expect(getVisibilitySnapshot()).toBe(true);
    expect(getBreakpointSnapshot()).toBeUndefined();
    expect(getScrollY()).toBe(0);
    for (const subscribe of [
      subscribeToOnlineStatus,
      subscribeToVisibility,
      subscribeToBreakpoint,
      subscribeToScroll,
    ]) {
      expect(() => {
        subscribe(notify)();
      }).not.toThrow();
    }
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('online status', () => {
  test.each([
    [false, false],
    [true, true],
    [undefined, true],
  ])('reads navigator.onLine %o as %o', (onLine, expected) => {
    vi.stubGlobal('navigator', { onLine });

    expect(getOnlineSnapshot()).toBe(expected);
  });

  test('listens for online and offline, and stops', () => {
    const fakeWindow = createTarget({});
    vi.stubGlobal('window', fakeWindow);
    const notify = vi.fn();

    const unsubscribe = subscribeToOnlineStatus(notify);
    unsubscribe();

    expect(fakeWindow.addEventListener.mock.calls).toStrictEqual([
      ['online', notify],
      ['offline', notify],
    ]);
    expect(fakeWindow.removeEventListener.mock.calls).toStrictEqual([
      ['online', notify],
      ['offline', notify],
    ]);
  });
});

describe('document visibility', () => {
  test.each([
    ['visible', true],
    ['hidden', false],
  ] as const)('reads %s as %o, and listens for changes', (visibilityState, expected) => {
    const fakeDocument = createTarget({ visibilityState });
    vi.stubGlobal('document', fakeDocument);
    const notify = vi.fn();

    expect(getVisibilitySnapshot()).toBe(expected);
    subscribeToVisibility(notify)();
    expect(fakeDocument.addEventListener).toHaveBeenCalledExactlyOnceWith(
      'visibilitychange',
      notify,
    );
    expect(fakeDocument.removeEventListener).toHaveBeenCalledExactlyOnceWith(
      'visibilitychange',
      notify,
    );
  });
});

describe('breakpoints', () => {
  test.each([
    [320, 'xs'],
    [639, 'xs'],
    [640, 'sm'],
    [768, 'md'],
    [1024, 'lg'],
    [1280, 'xl'],
    [1535, 'xl'],
    [1536, '2xl'],
  ] as const)('getBreakpointFromWidth(%d) -> %s', (width, expected) => {
    expect(getBreakpointFromWidth(width)).toBe(expected);
  });

  test.each([
    ['lg', 'md', true],
    ['md', 'md', true],
    ['xs', 'sm', false],
    ['2xl', 'xs', true],
    [undefined, 'xs', false],
  ] as const)('isBreakpointAtLeast(%s, %s) -> %o', (breakpoint, minimum, expected) => {
    expect(isBreakpointAtLeast(breakpoint, minimum)).toBe(expected);
  });

  test.each([
    [20, 'xs'],
    [40, 'sm'],
    [70, 'lg'],
    [100, '2xl'],
  ] as const)('reads a %d rem viewport as %s through its media queries', (widthRem, expected) => {
    const queries = new Map<string, ReturnType<typeof createTarget<{ matches: boolean }>>>();
    vi.stubGlobal(
      'window',
      createTarget({
        matchMedia: (query: string) => {
          const minimum = Number(/min-width: (\d+)rem/.exec(query)?.[1]);
          const list = createTarget({ matches: widthRem >= minimum });
          queries.set(query, list);
          return list;
        },
      }),
    );
    const notify = vi.fn();

    expect(getBreakpointSnapshot()).toBe(expected);
    subscribeToBreakpoint(notify)();
    expect([...queries.keys()].sort()).toStrictEqual([
      '(min-width: 40rem)',
      '(min-width: 48rem)',
      '(min-width: 64rem)',
      '(min-width: 80rem)',
      '(min-width: 96rem)',
    ]);
    for (const list of queries.values()) {
      expect(list.addEventListener).toHaveBeenCalledExactlyOnceWith('change', notify);
      expect(list.removeEventListener).toHaveBeenCalledExactlyOnceWith('change', notify);
    }
  });

  test('falls back to the width and resizes without media queries', () => {
    const fakeWindow = createTarget({ innerWidth: 375 });
    vi.stubGlobal('window', fakeWindow);
    const notify = vi.fn();

    expect(getBreakpointSnapshot()).toBe('xs');
    subscribeToBreakpoint(notify)();
    expect(fakeWindow.addEventListener).toHaveBeenCalledExactlyOnceWith('resize', notify);
    expect(fakeWindow.removeEventListener).toHaveBeenCalledExactlyOnceWith('resize', notify);
  });
});

describe('window scroll', () => {
  test('reads scrollY, and listens passively for scrolls', () => {
    const fakeWindow = createTarget({ scrollY: 240 });
    vi.stubGlobal('window', fakeWindow);
    const notify = vi.fn();

    expect(getScrollY()).toBe(240);
    subscribeToScroll(notify)();
    expect(fakeWindow.addEventListener).toHaveBeenCalledExactlyOnceWith('scroll', notify, {
      passive: true,
    });
    expect(fakeWindow.removeEventListener).toHaveBeenCalledExactlyOnceWith('scroll', notify, {
      passive: true,
    });
  });
});
