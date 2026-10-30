import type { IUiPreferences } from '../../contracts/index.js';

// partial patches never change the shape of a persisted complete snapshot
export type IUiPreferencesPatch = Partial<IUiPreferences>;

// provider-local state; persistence policy remains owned by the provider
export type IUiPreferencesStore = {
  uiPreferences: IUiPreferences;
  setUiPreferences: (uiPreferences: IUiPreferences) => void;
};
