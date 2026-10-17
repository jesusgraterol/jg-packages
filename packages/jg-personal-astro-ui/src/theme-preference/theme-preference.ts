import { THEME_PREFERENCES } from './constants.ts';
import type { IResolvedTheme, IThemePreference, IThemeStorage } from './types.ts';

/**
 * Reads a stored value as a theme preference, falling back to the system's theme for anything
 * else, because storage holds untrusted text.
 * @param value The stored value.
 * @returns The preference.
 * @example
 * parseThemePreference('dark'); // 'dark'
 * parseThemePreference('purple'); // 'system'
 */
export const parseThemePreference = (value: unknown): IThemePreference =>
  typeof value === 'string' && THEME_PREFERENCES.includes(value as IThemePreference)
    ? (value as IThemePreference)
    : 'system';

/**
 * Resolves a preference into the theme the page applies.
 * @param preference The preference.
 * @param systemPrefersDark Whether the operating system prefers a dark theme.
 * @returns 'light' or 'dark'.
 * @example
 * resolveThemePreference('system', true); // 'dark'
 * resolveThemePreference('light', true); // 'light'
 */
export const resolveThemePreference = (
  preference: IThemePreference,
  systemPrefersDark: boolean,
): IResolvedTheme =>
  preference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : preference;

/**
 * Reads the preference stored under a key, or the system's theme when there is none or storage is
 * unavailable, such as when the browser blocks it.
 * @param storageKey The key the site stores its preference under, such as 'jg-packages-theme'.
 * @param storage The storage. Defaults to localStorage.
 * @returns The preference.
 * @example
 * readThemePreference('jg-packages-theme'); // 'dark' after a visitor chose the dark theme
 */
export const readThemePreference = (
  storageKey: string,
  storage?: IThemeStorage,
): IThemePreference => {
  try {
    return parseThemePreference((storage ?? globalThis.localStorage).getItem(storageKey));
  } catch {
    return 'system';
  }
};

/**
 * Stores a preference under a key, and reports whether it could, because the browser can block
 * storage. The page still applies the preference when it can't.
 * @param storageKey The key the site stores its preference under.
 * @param preference The preference.
 * @param storage The storage. Defaults to localStorage.
 * @returns Whether the preference was stored.
 * @example
 * writeThemePreference('jg-packages-theme', 'light'); // true
 */
export const writeThemePreference = (
  storageKey: string,
  preference: IThemePreference,
  storage?: IThemeStorage,
): boolean => {
  try {
    (storage ?? globalThis.localStorage).setItem(storageKey, preference);
    return true;
  } catch {
    return false;
  }
};
