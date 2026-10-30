import { useCallback, useState } from 'react';

import {
  DEFAULT_UI_PREFERENCES,
  UiPreferencesProvider,
  type IUiPreferences,
} from 'jg-personal-react-ui';

import { RemoteControls } from './remote-controls.component.js';

// one deliberately controlled external persistence boundary for the private gallery
type IPendingSave = { resolve: () => void; reject: (error: unknown) => void };

/** Demonstrates remote confirmation and rollback independently of the local preference root. */
export const RemotePreferences = () => {
  const [save, setSave] = useState<IPendingSave | null>(null);
  const [authoritativePreferences, setAuthoritativePreferences] = useState(DEFAULT_UI_PREFERENCES);
  const persistPreferences = useCallback(
    (preferences: IUiPreferences) =>
      new Promise<void>((resolve, reject) => {
        setSave({
          resolve: () => {
            setAuthoritativePreferences(preferences);
            resolve();
          },
          reject,
        });
      }),
    [],
  );
  return (
    <section aria-labelledby="remote-preferences-title">
      <h2 id="remote-preferences-title">Remote preferences</h2>
      <p>
        Change a setting, then confirm or reject its save to inspect the optimistic state and
        rollback.
      </p>
      <UiPreferencesProvider
        mode="remote"
        storageId="jg-ui-gallery-remote"
        initialPreferences={authoritativePreferences}
        persistPreferences={persistPreferences}
      >
        <RemoteControls
          confirm={() => {
            save?.resolve();
            setSave(null);
          }}
          reject={() => {
            save?.reject(new Error('Private adapter diagnostic'));
            setSave(null);
          }}
        />
      </UiPreferencesProvider>
    </section>
  );
};
