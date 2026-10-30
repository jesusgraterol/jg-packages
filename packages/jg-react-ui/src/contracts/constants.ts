import type { IUiPreferences } from './types.js';

/** Initial complete preference record.
 * @see UiPreferencesSchema
 */
export const DEFAULT_UI_PREFERENCES: IUiPreferences = {
  theme: 'system',
  codeDiffView: 'split',
  prefersWrappedCode: false,
  appInstallToastrDismissedAt: null,
};

/** Default namespace for UI preference persistence.
 * @see UI_PREFERENCES_STORAGE_KEY
 */
export const UI_PREFERENCES_STORE_ID = 'jg-ui-preferences';
/** Raw storage key for interoperability with the UI preference store.
 * @see UI_PREFERENCES_STORE_ID
 */
export const UI_PREFERENCES_STORAGE_KEY = `jg-storage:${UI_PREFERENCES_STORE_ID}`;
