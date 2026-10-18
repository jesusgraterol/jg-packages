import { runInNewContext } from 'node:vm';
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { createThemeInitScript } from './init-script.js';
import type { IThemeInitScriptOptions } from './types.js';

// the browser a script runs in: what localStorage holds, and the system's color scheme
type IFakeBrowser = {
  stored?: Record<string, string>;
  isStorageDenied?: boolean;
  systemPrefersDark?: boolean | undefined;
  initialClasses?: string[];
};

/**
 * Runs a theme script in a fresh context against a fake browser.
 * @param options The script's options.
 * @param browser The fake browser.
 * @returns The classes the script left on the root element.
 */
const runScript = (options: IThemeInitScriptOptions, browser: IFakeBrowser = {}): string[] => {
  const classes = new Set(browser.initialClasses ?? []);
  const localStorage = {
    getItem: (key: string) => browser.stored?.[key] ?? null,
  };
  const window = {
    get localStorage() {
      if (browser.isStorageDenied === true) {
        throw new Error('SecurityError: The operation is insecure.');
      }
      return localStorage;
    },
    ...(browser.systemPrefersDark === undefined
      ? {}
      : {
          matchMedia: (query: string) => ({
            matches: query.includes('dark') && browser.systemPrefersDark,
          }),
        }),
  };
  const document = {
    documentElement: {
      classList: {
        add: (...names: string[]) => names.forEach((name) => classes.add(name)),
        remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
      },
    },
  };
  runInNewContext(createThemeInitScript(options), { window, document });
  return [...classes].sort();
};

const KEY = 'jg-storage:preferences';

describe('createThemeInitScript', () => {
  test.each([
    ['light', false, ['light']],
    ['light', true, ['light']],
    ['dark', false, ['dark']],
    ['dark', true, ['dark']],
    ['system', false, ['light']],
    ['system', true, ['dark']],
  ] as const)(
    'applies a stored %s preference, with a dark system: %s',
    (stored, isDark, expected) => {
      expect(
        runScript(
          { storageKey: KEY },
          { stored: { [KEY]: JSON.stringify(stored) }, systemPrefersDark: isDark },
        ),
      ).toStrictEqual(expected);
    },
  );

  test('reads a raw string as well as the JSON jg-storage writes', () => {
    expect(runScript({ storageKey: KEY }, { stored: { [KEY]: 'dark' } })).toStrictEqual(['dark']);
  });

  test('reads the field of a stored object', () => {
    const stored = { [KEY]: JSON.stringify({ theme: 'dark', locale: 'en' }) };

    expect(runScript({ storageKey: KEY, field: 'theme' }, { stored })).toStrictEqual(['dark']);
  });

  test.each([
    ['nothing stored', undefined],
    ['an unknown preference', JSON.stringify('sepia')],
    ['a number', '42'],
    ['null', 'null'],
    ['an array', JSON.stringify(['dark'])],
  ])('falls back to the default preference for %s', (_, value) => {
    const stored = value === undefined ? {} : { [KEY]: value };

    expect(runScript({ storageKey: KEY, defaultPreference: 'dark' }, { stored })).toStrictEqual([
      'dark',
    ]);
  });

  test.each([
    ['a missing field', JSON.stringify({ locale: 'en' })],
    ['an inherited field', JSON.stringify({})],
    ['a value that is not an object', JSON.stringify('dark')],
    ['an array', JSON.stringify([{ theme: 'dark' }])],
    ['text that is not JSON', 'dark'],
  ])('falls back to the default preference for a field read from %s', (_, value) => {
    const field = value === JSON.stringify({}) ? 'constructor' : 'theme';

    expect(
      runScript(
        { storageKey: KEY, field, defaultPreference: 'light' },
        { stored: { [KEY]: value } },
      ),
    ).toStrictEqual(['light']);
  });

  test('falls back to the default preference when storage is denied', () => {
    expect(
      runScript({ storageKey: KEY, defaultPreference: 'dark' }, { isStorageDenied: true }),
    ).toStrictEqual(['dark']);
  });

  test('resolves the system preference to light without matchMedia', () => {
    expect(runScript({ storageKey: KEY }, { systemPrefersDark: undefined })).toStrictEqual([
      'light',
    ]);
  });

  test('replaces the other theme class', () => {
    expect(
      runScript(
        { storageKey: KEY },
        { stored: { [KEY]: '"dark"' }, initialClasses: ['light', 'app'] },
      ),
    ).toStrictEqual(['app', 'dark']);
  });

  test('escapes a hostile key and field, which it still reads exactly', () => {
    const storageKey = '</script><script>alert(1)</script>\u2028&';
    const field = '<b>\u2029</b>';
    const script = createThemeInitScript({ storageKey, field });

    // the script's own code has no angle brackets, and uses & only in its && operators
    expect(script).not.toMatch(/[<>\u2028\u2029]/);
    expect(script.replaceAll('&&', '')).not.toContain('&');
    expect(
      runScript(
        { storageKey, field },
        { stored: { [storageKey]: JSON.stringify({ [field]: 'dark' }) } },
      ),
    ).toStrictEqual(['dark']);
  });

  test('builds the same script for the same options, for a hash-based CSP', () => {
    expect(createThemeInitScript({ storageKey: KEY, field: 'theme' })).toBe(
      createThemeInitScript({ storageKey: KEY, field: 'theme' }),
    );
  });

  test.each([
    ['an empty storage key', { storageKey: '' }],
    ['a storage key that is not a string', { storageKey: 42 }],
    ['an empty field', { storageKey: KEY, field: '' }],
    ['an unknown default preference', { storageKey: KEY, defaultPreference: 'sepia' }],
  ])('throws INVALID_THEME_SCRIPT_OPTIONS for %s', (_, options) => {
    expectToThrowCode(
      () => createThemeInitScript(options as unknown as IThemeInitScriptOptions),
      ERRORS.INVALID_THEME_SCRIPT_OPTIONS,
    );
  });
});
