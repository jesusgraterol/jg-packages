// types
export type {
  ILocalUiPreferencesProviderProps,
  IReadOnlyUiPreferencesProviderProps,
  IRemoteUiPreferencesProviderProps,
  IUiPreferencesContextState,
  IUiPreferencesPersistenceAdapter,
  IUiPreferencesProviderProps,
  IUiPreferencesSuccessNotification,
  IUiPreferencesUpdateOptions,
} from './types.js';

// components
export { UiPreferencesProvider } from './ui-preferences-provider.component.js';

// hooks
export { useUiPreferences, useUiPreferencesCapabilities } from './ui-preferences.hook.js';
