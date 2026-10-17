// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';

import { REDUCED_MOTION_QUERY } from './constants.js';
import {
  hasNavigator,
  hasWindow,
  isIndexedDbAvailable,
  prefersReducedMotion,
} from './environment.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hasWindow', () => {
  test.each([
    [undefined, false],
    [{}, true],
  ])('hasWindow() with window %o -> %s', (value, expected) => {
    vi.stubGlobal('window', value);
    expect(hasWindow()).toBe(expected);
  });
});

describe('hasNavigator', () => {
  test.each([
    [undefined, false],
    [{ userAgent: 'Node.js/24' }, true],
  ])('hasNavigator() with navigator %o -> %s', (value, expected) => {
    vi.stubGlobal('navigator', value);
    expect(hasNavigator()).toBe(expected);
  });
});

describe('isIndexedDbAvailable', () => {
  test.each([
    [undefined, false],
    [{ open: () => undefined }, true],
  ])('isIndexedDbAvailable() with indexedDB %o -> %s', (value, expected) => {
    vi.stubGlobal('indexedDB', value);
    expect(isIndexedDbAvailable()).toBe(expected);
  });
});

describe('prefersReducedMotion', () => {
  const createView = (matches: boolean) => ({
    matchMedia: vi.fn((query: string) => ({ matches: query === REDUCED_MOTION_QUERY && matches })),
  });

  test.each([
    [true, true],
    [false, false],
  ])('prefersReducedMotion() with a global window that matches %s -> %s', (matches, expected) => {
    const view = createView(matches);
    vi.stubGlobal('window', view);

    expect(prefersReducedMotion()).toBe(expected);
    expect(view.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
  });

  test.each([
    [true, true],
    [false, false],
  ])('prefersReducedMotion(view) with a view that matches %s -> %s', (matches, expected) => {
    vi.stubGlobal('window', createView(!matches));

    expect(prefersReducedMotion(createView(matches))).toBe(expected);
  });

  test('returns false without a global window', () => {
    vi.stubGlobal('window', undefined);

    expect(prefersReducedMotion()).toBe(false);
  });

  test('returns false for a null view, even when the global window prefers reduced motion', () => {
    vi.stubGlobal('window', createView(true));

    expect(prefersReducedMotion(null)).toBe(false);
  });

  test('returns false for a view without matchMedia', () => {
    expect(prefersReducedMotion({})).toBe(false);
  });
});
