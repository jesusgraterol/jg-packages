// types
export type { IUiPreferencesPatch, IUiPreferencesStore } from './types.js';

// normalization and comparison
export { normalizeUiPreferences, areUiPreferencesEqual } from './utilities.js';

// scoped stores
export { createUiPreferencesStore } from './store.js';

// persistence
export { readStoredUiPreferences, writeStoredUiPreferences } from './storage.js';

// React store binding
export { UiPreferencesStoreContext } from './store.context.js';
export { useUiPreferencesStore, useUiPreferencesStoreApi } from './store.hook.js';
