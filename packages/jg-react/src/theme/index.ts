// types
export type {
  IAppliedThemeOptions,
  IResolvedTheme,
  IThemeInitScriptOptions,
  IThemePreference,
} from './types.js';

// constants
export { THEME_PREFERENCES } from './constants.js';

// functions
export { createThemeInitScript } from './init-script.js';
export { resolveThemePreference } from './utilities.js';

// hooks
export { useAppliedTheme } from './applied-theme.hook.js';
export { useDocumentTheme } from './document-theme.hook.js';
export { useResolvedTheme } from './resolved-theme.hook.js';
