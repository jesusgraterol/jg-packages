import { createContext } from 'react';

import type { IUiPreferencesCapabilities } from './types.js';

const noopUpdatePreferences = (): void => {};

// missing providers are safely read-only so standalone display surfaces cannot mutate local state.
export const UiPreferencesCapabilitiesContext = createContext<IUiPreferencesCapabilities>({
  canUpdatePreferences: false,
  isPreferencesUpdatePending: false,
  updatePreferences: noopUpdatePreferences,
});
