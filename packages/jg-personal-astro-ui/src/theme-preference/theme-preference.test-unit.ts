import { describe, expect, test } from 'vitest';

import {
  parseThemePreference,
  readThemePreference,
  resolveThemePreference,
  writeThemePreference,
} from './theme-preference.ts';
import type { IThemeStorage } from './types.ts';

/**
 * Builds a storage backed by a map.
 * @returns The storage and its items.
 */
const createStorage = (): IThemeStorage & { items: Map<string, string> } => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
};

// a storage that throws, as a browser does when it blocks storage
const BLOCKED_STORAGE: IThemeStorage = {
  getItem: () => {
    throw new Error('The operation is insecure.');
  },
  setItem: () => {
    throw new Error('The operation is insecure.');
  },
};

describe('parseThemePreference', () => {
  test.each(['system', 'light', 'dark'])('accepts %s', (value) => {
    expect(parseThemePreference(value)).toBe(value);
  });

  test.each([null, undefined, '', 'Dark', 'purple', 1, {}])(
    'falls back to system for %j',
    (value) => {
      expect(parseThemePreference(value)).toBe('system');
    },
  );
});

describe('resolveThemePreference', () => {
  test.each([
    ['system', true, 'dark'],
    ['system', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
  ] as const)(
    'resolves %s with a dark system %s to %s',
    (preference, systemPrefersDark, expected) => {
      expect(resolveThemePreference(preference, systemPrefersDark)).toBe(expected);
    },
  );
});

describe('readThemePreference and writeThemePreference', () => {
  test('store and read the preference under the given key', () => {
    const storage = createStorage();

    expect(readThemePreference('site-theme', storage)).toBe('system');
    expect(writeThemePreference('site-theme', 'dark', storage)).toBe(true);
    expect(storage.items.get('site-theme')).toBe('dark');
    expect(readThemePreference('site-theme', storage)).toBe('dark');
    expect(readThemePreference('other-theme', storage)).toBe('system');
  });

  test('read an invalid stored value as the system preference', () => {
    const storage = createStorage();
    storage.items.set('site-theme', 'sepia');

    expect(readThemePreference('site-theme', storage)).toBe('system');
  });

  test('survive blocked storage', () => {
    expect(readThemePreference('site-theme', BLOCKED_STORAGE)).toBe('system');
    expect(writeThemePreference('site-theme', 'light', BLOCKED_STORAGE)).toBe(false);
  });
});
