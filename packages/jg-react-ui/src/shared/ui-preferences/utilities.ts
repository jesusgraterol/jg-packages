import { isObjectValid } from 'jg-utilities';

import {
  AppThemeSchema,
  CodeDiffViewSchema,
  DEFAULT_UI_PREFERENCES,
  UiPreferencesSchema,
  type IUiPreferences,
} from '../../contracts/index.js';

/**
 * Normalizes complete or partial preferences while retaining valid source fields and defaults.
 * @param uiPreferences The application or persisted value to normalize.
 * @param defaultUiPreferences Defaults for missing or invalid fields.
 * @returns A complete preference record.
 */
export const normalizeUiPreferences = (
  uiPreferences: unknown,
  defaultUiPreferences: IUiPreferences = DEFAULT_UI_PREFERENCES,
): IUiPreferences => {
  const preferenceRecord: Record<string, unknown> = isObjectValid(uiPreferences, true)
    ? uiPreferences
    : {};
  const themeResult = AppThemeSchema.safeParse(preferenceRecord['theme']);
  const codeDiffViewResult = CodeDiffViewSchema.safeParse(preferenceRecord['codeDiffView']);
  const dismissedAtResult = UiPreferencesSchema.shape.appInstallToastrDismissedAt.safeParse(
    preferenceRecord['appInstallToastrDismissedAt'],
  );
  return {
    theme: themeResult.success ? themeResult.data : defaultUiPreferences.theme,
    codeDiffView: codeDiffViewResult.success
      ? codeDiffViewResult.data
      : defaultUiPreferences.codeDiffView,
    prefersWrappedCode:
      typeof preferenceRecord['prefersWrappedCode'] === 'boolean'
        ? preferenceRecord['prefersWrappedCode']
        : defaultUiPreferences.prefersWrappedCode,
    appInstallToastrDismissedAt: dismissedAtResult.success
      ? dismissedAtResult.data
      : defaultUiPreferences.appInstallToastrDismissedAt,
  };
};

/**
 * Compares the fixed preference contract without serializing or allocating snapshots.
 * @param firstPreferences The first complete record.
 * @param secondPreferences The second complete record.
 * @returns Whether all source-supported fields are equal.
 */
export const areUiPreferencesEqual = (
  firstPreferences: IUiPreferences,
  secondPreferences: IUiPreferences,
): boolean =>
  firstPreferences.theme === secondPreferences.theme &&
  firstPreferences.codeDiffView === secondPreferences.codeDiffView &&
  firstPreferences.prefersWrappedCode === secondPreferences.prefersWrappedCode &&
  firstPreferences.appInstallToastrDismissedAt === secondPreferences.appInstallToastrDismissedAt;
