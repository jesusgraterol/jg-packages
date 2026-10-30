/** Owned UI configuration failures exposed through the public error-code contract.
 * @see UiPreferencesProvider
 * @see useTheme
 */
export const ERRORS = {
  THEME_PROVIDER_MISSING: 'THEME_PROVIDER_MISSING',
  UI_PREFERENCES_STORAGE_ID_INVALID: 'UI_PREFERENCES_STORAGE_ID_INVALID',
} as const;
