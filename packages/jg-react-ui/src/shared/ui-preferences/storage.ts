import { createLocalStore } from 'jg-storage';

import {
  DEFAULT_UI_PREFERENCES,
  getUiPreferencesStorageKey,
  UI_PREFERENCES_STORE_ID,
  type IUiPreferences,
} from '../../contracts/index.js';

import type { IUiPreferencesPatch } from './types.js';
import { normalizeUiPreferences } from './utilities.js';

/**
 * Reads stored preferences, falling back when storage is malformed or unavailable.
 * @param storageId The captured provider namespace.
 * @returns A normalized complete preference record.
 * @throws
 * - UI_PREFERENCES_STORAGE_ID_INVALID: UI preferences storage ID must be a non-empty string containing only letters, digits, underscores, and hyphens.
 */
export const readStoredUiPreferences = (storageId = UI_PREFERENCES_STORE_ID): IUiPreferences => {
  getUiPreferencesStorageKey(storageId);
  try {
    return normalizeUiPreferences(
      createLocalStore<IUiPreferences | IUiPreferencesPatch>(storageId).get(),
    );
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
};

/**
 * Persists the normalized snapshot when browser storage is available.
 * @param preferences The complete snapshot to persist.
 * @param storageId The captured provider namespace.
 * @throws
 * - UI_PREFERENCES_STORAGE_ID_INVALID: UI preferences storage ID must be a non-empty string containing only letters, digits, underscores, and hyphens.
 */
export const writeStoredUiPreferences = (
  preferences: IUiPreferences,
  storageId = UI_PREFERENCES_STORE_ID,
): void => {
  getUiPreferencesStorageKey(storageId);
  try {
    createLocalStore<IUiPreferences>(storageId).set(undefined, normalizeUiPreferences(preferences));
  } catch {
    /* browser persistence is best-effort; the provider retains the current in-memory state */
  }
};
