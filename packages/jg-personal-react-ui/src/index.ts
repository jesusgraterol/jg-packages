// shared React surface
export {
  Button,
  buttonVariants,
  cn,
  type IButtonProps,
  type IButtonBadgeLocation,
  type IButtonBadgeTheme,
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
} from 'jg-react-ui';

// badge
export { Badge, badgeVariants, type IBadgeProps } from 'jg-react-ui/components/badge';

// icon-tile
export {
  IconTile,
  iconTileVariants,
  type IIconTileProps,
  type IIconTileSize,
  type IIconTileTone,
} from 'jg-react-ui/components/icon-tile';

// alert
export {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  alertVariants,
  type IAlertActionProps,
  type IAlertDescriptionProps,
  type IAlertProps,
  type IAlertTitleProps,
} from 'jg-react-ui/components/alert';

// brand mark
export { JgMark, type IJgMarkProps } from './components/jg-mark/index.js';

// scoped error policy
export {
  ErrorFeedbackProvider,
  useErrorFeedbackResolver,
  type IErrorFeedbackProviderProps,
} from './components/error-feedback-provider/index.js';
export type { IErrorFeedbackResolver } from './contracts/index.js';

// ui-preferences-provider
export {
  type ILocalUiPreferencesProviderProps,
  type IReadOnlyUiPreferencesProviderProps,
  type IRemoteUiPreferencesProviderProps,
  type IUiPreferencesContextState,
  type IUiPreferencesPersistenceAdapter,
  type IUiPreferencesProviderProps,
  type IUiPreferencesSuccessNotification,
  type IUiPreferencesUpdateOptions,
  UiPreferencesProvider,
  useUiPreferences,
  useUiPreferencesCapabilities,
} from './components/ui-preferences-provider/index.js';

// theme-provider
export {
  type IThemeChangeRequestedHandler,
  type IThemeInitializationScriptProps,
  type IThemeProviderProps,
  type IThemeProviderState,
  type IThemeToggleButtonProps,
  ThemeInitializationScript,
  ThemeProvider,
  ThemeToggleButton,
  useTheme,
} from './components/theme-provider/index.js';

// toastr
export {
  type IExternalToastr,
  type IToastrClassNames,
  type IToastrProps,
  Toastr,
  toastr,
} from './components/toastr/index.js';

// errors and preference namespaces
export { ERRORS } from './errors/index.js';
export { getUiPreferencesStorageKey } from './contracts/index.js';
