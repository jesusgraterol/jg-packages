import { useContext } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import { DEFAULT_UI_PREFERENCES } from '../../contracts/index.js';

import { UiPreferencesStoreContext } from './store.context.js';
import type { IUiPreferencesStore } from './types.js';

// the unprovided snapshot is read-only and cannot overwrite any mounted provider
const DEFAULT_STATE: IUiPreferencesStore = {
  uiPreferences: DEFAULT_UI_PREFERENCES,
  setUiPreferences: () => {},
};
const READ_ONLY_STORE = {
  getState: () => DEFAULT_STATE,
  getInitialState: () => DEFAULT_STATE,
  subscribe: () => () => {},
};

/** Reads the nearest store API without subscribing to unrelated fields. */
export const useUiPreferencesStoreApi = (): Pick<
  StoreApi<IUiPreferencesStore>,
  'getState' | 'getInitialState' | 'subscribe'
> => useContext(UiPreferencesStoreContext) ?? READ_ONLY_STORE;

/**
 * Subscribes to one selected value of the nearest provider's preference store.
 * @param selector The fixed-field projection to observe.
 * @returns The selected state, with read-only defaults outside a provider.
 */
export const useUiPreferencesStore = <TSelection>(
  selector: (state: IUiPreferencesStore) => TSelection,
): TSelection => useStore(useUiPreferencesStoreApi(), selector);
