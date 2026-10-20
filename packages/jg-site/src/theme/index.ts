// types
export type { IResolvedTheme, IThemePreference, IThemeStorage } from './types.js';

// constants
export { THEME_PREFERENCES } from './constants.js';

// preferences
export {
  parseThemePreference,
  readThemePreference,
  resolveThemePreference,
  writeThemePreference,
} from './theme.js';
