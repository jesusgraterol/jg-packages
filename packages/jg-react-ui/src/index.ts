// buttons
export {
  Button,
  buttonVariants,
  type IButtonProps,
  type IButtonBadgeLocation,
  type IButtonBadgeTheme,
} from './components/button/index.js';

// class composition
export { cn } from './cn/index.js';

// preference contracts
export {
  AppThemeSchema,
  ResolvedAppThemeSchema,
  CodeDiffViewSchema,
  UiPreferencesSchema,
  DEFAULT_UI_PREFERENCES,
  UI_PREFERENCES_STORE_ID,
  UI_PREFERENCES_STORAGE_KEY,
  type IAppTheme,
  type IResolvedAppTheme,
  type ICodeDiffView,
  type IUiPreferences,
} from './contracts/index.js';
