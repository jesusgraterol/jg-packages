import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  applyThemeClass,
  getSystemDarkSchemeSnapshot,
  isThemeClassApplied,
  resolveThemePreference,
  subscribeToNothing,
  subscribeToSystemDarkScheme,
  suppressTransitions,
} from './utilities.js';

/**
 * Builds an element whose classList holds classes in a set.
 * @param classes Its classes.
 * @returns The element.
 */
const createRoot = (...classes: string[]) => {
  const names = new Set(classes);
  return {
    names,
    classList: {
      contains: (name: string) => names.has(name),
      add: (...added: string[]) => added.forEach((name) => names.add(name)),
      remove: (...removed: string[]) => removed.forEach((name) => names.delete(name)),
    },
  } as unknown as Element & { names: Set<string> };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveThemePreference', () => {
  test.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('resolveThemePreference(%s, %s) -> %s', (preference, isDark, expected) => {
    expect(resolveThemePreference(preference, isDark)).toBe(expected);
  });
});

describe('the system color scheme', () => {
  test('reads the dark color scheme query, and listens for its changes', () => {
    const query = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const matchMedia = vi.fn(() => query);
    vi.stubGlobal('window', { matchMedia });
    const onChange = vi.fn();

    expect(getSystemDarkSchemeSnapshot()).toBe(true);
    const unsubscribe = subscribeToSystemDarkScheme(onChange);
    unsubscribe();

    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    expect(query.addEventListener).toHaveBeenCalledWith('change', onChange);
    expect(query.removeEventListener).toHaveBeenCalledWith('change', onChange);
  });

  test('reads light, and listens to nothing, without a window or matchMedia', () => {
    expect(getSystemDarkSchemeSnapshot()).toBe(false);
    expect(() => subscribeToSystemDarkScheme(vi.fn())()).not.toThrow();

    vi.stubGlobal('window', {});
    expect(getSystemDarkSchemeSnapshot()).toBe(false);
    expect(() => subscribeToSystemDarkScheme(vi.fn())()).not.toThrow();
    expect(() => subscribeToNothing()()).not.toThrow();
  });
});

describe('the theme class', () => {
  test("is applied only when the element has the theme's class and not the other one", () => {
    expect(isThemeClassApplied(createRoot('dark'), 'dark')).toBe(true);
    expect(isThemeClassApplied(createRoot('dark', 'light'), 'dark')).toBe(false);
    expect(isThemeClassApplied(createRoot(), 'light')).toBe(false);
    expect(isThemeClassApplied(createRoot('light', 'app'), 'light')).toBe(true);
  });

  test('replaces the other theme class, and keeps the rest', () => {
    const root = createRoot('light', 'app');

    applyThemeClass(root, 'dark');

    expect([...root.names].sort()).toStrictEqual(['app', 'dark']);
  });
});

describe('suppressTransitions', () => {
  /**
   * Builds a document that records its style element and runs animation frames on demand.
   * @param hasWindow Whether the document has a window.
   * @returns The document, its style element's state, and the queued animation frames.
   */
  const createDocument = (hasWindow: boolean) => {
    const frames: (() => void)[] = [];
    const style = { appendChild: vi.fn(), remove: vi.fn() };
    const appendToHead = vi.fn();
    const view = {
      getComputedStyle: vi.fn(),
      requestAnimationFrame: vi.fn((callback: () => void) => frames.push(callback)),
    };
    const target = {
      body: {},
      head: { appendChild: appendToHead },
      createElement: vi.fn(() => style),
      createTextNode: vi.fn((text: string) => ({ text })),
      defaultView: hasWindow ? view : null,
    } as unknown as Document;
    return { target, style, view, frames, appendToHead };
  };

  test('turns transitions off, then removes the style two animation frames after the change', () => {
    const { target, style, view, frames, appendToHead } = createDocument(true);

    const restore = suppressTransitions(target);

    expect(appendToHead).toHaveBeenCalledWith(style);
    expect(style.appendChild).toHaveBeenCalledWith({
      text: '*,*::before,*::after{-webkit-transition:none!important;transition:none!important}',
    });

    restore();
    expect(view.getComputedStyle).toHaveBeenCalledWith(target.body);
    expect(style.remove).not.toHaveBeenCalled();

    frames.shift()?.();
    expect(style.remove).not.toHaveBeenCalled();
    frames.shift()?.();
    expect(style.remove).toHaveBeenCalledOnce();
  });

  test('removes the style at once in a document without a window', () => {
    const { target, style } = createDocument(false);

    suppressTransitions(target)();

    expect(style.remove).toHaveBeenCalledOnce();
  });
});
