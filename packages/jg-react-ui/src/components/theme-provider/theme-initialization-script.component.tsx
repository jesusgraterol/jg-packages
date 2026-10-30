import type * as React from 'react';

import { createThemeInitScript } from 'jg-react';

import { getUiPreferencesStorageKey } from '../../contracts/index.js';

import type { IThemeInitializationScriptProps } from './types.js';

/**
 * Renders the server-safe inline script that applies the persisted theme before hydration.
 * @param props The script identity and CSP nonce.
 * @returns A React script element containing the package-owned initialization logic.
 * @example
 * import { createElement } from 'react';
 * import { ThemeInitializationScript } from 'jg-react-ui/components/theme-provider';
 * const script = createElement(ThemeInitializationScript, { storageId: 'personal-hq', nonce: 'example-nonce' });
 * @throws
 * - UI_PREFERENCES_STORAGE_ID_INVALID: UI preferences storage ID must be a non-empty string containing only letters, digits, underscores, and hyphens.
 */
export const ThemeInitializationScript = ({
  id,
  nonce,
  storageId,
}: IThemeInitializationScriptProps): React.ReactElement => (
  <script
    id={id}
    nonce={nonce}
    dangerouslySetInnerHTML={{
      __html: createThemeInitScript({
        storageKey: getUiPreferencesStorageKey(storageId),
        field: 'theme',
      }),
    }}
  />
);
