import type { IThemePreference } from './types.ts';

// every preference a visitor can choose
export const THEME_PREFERENCES: readonly IThemePreference[] = Object.freeze([
  'system',
  'light',
  'dark',
]);

// the window event a theme control fires with { preference } to change the theme
export const THEME_CHANGE_EVENT = 'jg-theme-change';

// the window event the theme script fires after it applies a theme
export const THEME_APPLIED_EVENT = 'jg-theme-applied';
