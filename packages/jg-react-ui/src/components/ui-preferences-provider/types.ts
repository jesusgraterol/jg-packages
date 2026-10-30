import type * as React from 'react';

import type { IUiPreferences } from '../../contracts/index.js';

import type { IUiPreferencesPatch } from '../../shared/ui-preferences/index.js';

/** Remote persistence adapters keep API and application cache ownership outside app-ui.
 * @see UiPreferencesProvider
 */
export type IUiPreferencesPersistenceAdapter = {
  persistPreferences: (uiPreferences: IUiPreferences) => Promise<void>;
};

/** Optional feedback shown only after the latest requested remote revision is confirmed.
 * @see UiPreferencesProvider
 */
export type IUiPreferencesSuccessNotification = {
  title: string;
  description?: string;
};

/** Per-update behavior that does not alter the persisted preference contract.
 * @see UiPreferencesProvider
 */
export type IUiPreferencesUpdateOptions = {
  successNotification?: IUiPreferencesSuccessNotification;
};

type IUiPreferencesProviderBaseProps = {
  storageId?: string;
  children: React.ReactNode;
};

/** Local mode enables controls and confirms changes in browser storage immediately.
 * @see UiPreferencesProvider
 */
export type ILocalUiPreferencesProviderProps = IUiPreferencesProviderBaseProps & {
  initialPreferences?: IUiPreferences;
  mode: 'local';
};

/** Read-only mode exposes preferences without granting mutation capability.
 * @see UiPreferencesProvider
 */
export type IReadOnlyUiPreferencesProviderProps = IUiPreferencesProviderBaseProps & {
  initialPreferences?: IUiPreferences;
  mode: 'read-only';
};

/** Remote mode requires authoritative preferences and a rejecting async persistence adapter.
 * @see UiPreferencesProvider
 */
export type IRemoteUiPreferencesProviderProps = IUiPreferencesProviderBaseProps &
  IUiPreferencesPersistenceAdapter & {
    initialPreferences: IUiPreferences;
    mode: 'remote';
  };

/** Provider props use an explicit mode so editable surfaces cannot silently skip persistence.
 * @see UiPreferencesProvider
 */
export type IUiPreferencesProviderProps =
  | ILocalUiPreferencesProviderProps
  | IReadOnlyUiPreferencesProviderProps
  | IRemoteUiPreferencesProviderProps;

/** Context state exposes the current snapshot and provider-owned update lifecycle.
 * @see UiPreferencesProvider
 */
export type IUiPreferencesContextState = {
  canUpdatePreferences: boolean;
  isPreferencesUpdatePending: boolean;
  preferences: IUiPreferences;
  updatePreferences: (
    uiPreferencesPatch: IUiPreferencesPatch,
    options?: IUiPreferencesUpdateOptions,
  ) => void;
};

/** Internal capability state avoids rerendering preference readers for unrelated values.
 * @see UiPreferencesProvider
 */
export type IUiPreferencesCapabilities = Omit<IUiPreferencesContextState, 'preferences'>;
