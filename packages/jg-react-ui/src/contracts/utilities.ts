import { Exception } from 'jg-exception';

import { ERRORS } from '../errors/index.js';

import { UI_PREFERENCES_STORE_ID } from './constants.js';

/**
 * Derives the raw preference key using jg-storage's namespace rules.
 * @param storageId The non-empty namespace containing letters, digits, underscores, or hyphens.
 * @returns The raw localStorage key shared by persistence, storage events, and the pre-paint script.
 * @example
 * import { getUiPreferencesStorageKey } from 'jg-react-ui/contracts';
 * const key = getUiPreferencesStorageKey('personal-hq');
 * @throws
 * - UI_PREFERENCES_STORAGE_ID_INVALID: UI preferences storage ID must be a non-empty string containing only letters, digits, underscores, and hyphens.
 */
export const getUiPreferencesStorageKey = (storageId: string = UI_PREFERENCES_STORE_ID): string => {
  if (typeof storageId !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(storageId)) {
    throw new Exception(
      'UI preferences storage ID must be a non-empty string containing only letters, digits, underscores, and hyphens.',
      { code: ERRORS.UI_PREFERENCES_STORAGE_ID_INVALID },
    );
  }
  return `jg-storage:${storageId}`;
};
