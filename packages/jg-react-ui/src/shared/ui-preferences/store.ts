import { createStore, type StoreApi } from 'zustand/vanilla';

import type { IUiPreferences } from '../../contracts/index.js';

import type { IUiPreferencesStore } from './types.js';
import { areUiPreferencesEqual, normalizeUiPreferences } from './utilities.js';

/**
 * Creates one preference store per provider, without reading browser storage during render.
 * @param initialPreferences The server-compatible initial snapshot.
 * @returns A new in-memory store that cannot overwrite another provider's state.
 */
export const createUiPreferencesStore = (
  initialPreferences?: IUiPreferences,
): StoreApi<IUiPreferencesStore> =>
  createStore<IUiPreferencesStore>()((set) => ({
    uiPreferences: normalizeUiPreferences(initialPreferences),
    setUiPreferences: (preferences) => {
      const nextPreferences = normalizeUiPreferences(preferences);
      set((state) =>
        areUiPreferencesEqual(state.uiPreferences, nextPreferences)
          ? state
          : { uiPreferences: nextPreferences },
      );
    },
  }));
