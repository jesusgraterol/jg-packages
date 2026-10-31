// types and schemas
export {
  AppThemeSchema,
  ResolvedAppThemeSchema,
  CodeDiffViewSchema,
  UiPreferencesSchema,
  type IAppTheme,
  type IResolvedAppTheme,
  type ICodeDiffView,
  type IUiPreferences,
} from './types.js';

// constants
export {
  DEFAULT_UI_PREFERENCES,
  UI_PREFERENCES_STORE_ID,
  UI_PREFERENCES_STORAGE_KEY,
} from './constants.js';

// error policy
export type { IErrorFeedbackResolver } from './types.js';

// preference namespaces
export { getUiPreferencesStorageKey } from './utilities.js';
