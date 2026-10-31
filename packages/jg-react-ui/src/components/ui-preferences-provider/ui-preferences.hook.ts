import { useContext, useMemo } from 'react';

import { useUiPreferencesStore } from '../../shared/ui-preferences/index.js';
import type { IUiPreferencesCapabilities, IUiPreferencesContextState } from './types.js';
import { UiPreferencesCapabilitiesContext } from './ui-preferences.context.js';

/**
 * Reads the current UI preferences and provider-owned update lifecycle.
 * @returns The current preference snapshot, mutation capability, and pending state.
 * @example
 * import { useUiPreferences } from 'jg-react-ui/components/ui-preferences-provider';
 * const WrappingPreference = () => String(useUiPreferences().preferences.prefersWrappedCode);
 */
export const useUiPreferences = (): IUiPreferencesContextState => {
  const preferences = useUiPreferencesStore((state) => state.uiPreferences);
  const capabilities = useContext(UiPreferencesCapabilitiesContext);

  return useMemo(() => ({ ...capabilities, preferences }), [capabilities, preferences]);
};

/**
 * Reads provider capabilities without subscribing to the complete preference snapshot.
 * @returns The mutation capability and pending state owned by the nearest provider.
 * @example
 * import { useUiPreferencesCapabilities } from 'jg-react-ui/components/ui-preferences-provider';
 * const Capability = () => String(useUiPreferencesCapabilities().canUpdatePreferences);
 */
export const useUiPreferencesCapabilities = (): IUiPreferencesCapabilities =>
  useContext(UiPreferencesCapabilitiesContext);
