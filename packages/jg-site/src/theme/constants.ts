import type { IThemePreference } from './types.js';

// every preference a visitor can choose
export const THEME_PREFERENCES: readonly IThemePreference[] = Object.freeze([
  'system',
  'light',
  'dark',
]);
