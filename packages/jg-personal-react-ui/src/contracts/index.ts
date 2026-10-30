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
} from 'jg-react-ui/contracts';

// error policy
export type { IErrorFeedbackResolver } from 'jg-react-ui/contracts';

// preference namespaces
export { getUiPreferencesStorageKey } from 'jg-react-ui/contracts';
