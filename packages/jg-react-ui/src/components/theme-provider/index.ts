'use client';

// types
export type {
  IThemeChangeRequestedHandler,
  IThemeInitializationScriptProps,
  IThemeProviderProps,
  IThemeProviderState,
  IThemeToggleButtonProps,
} from './types.js';

// components
export { ThemeInitializationScript } from './theme-initialization-script.component.js';
export { ThemeProvider } from './theme-provider.component.js';
export { ThemeToggleButton } from './theme-toggle-button.component.js';

// hooks
export { useTheme } from './theme.hook.js';
