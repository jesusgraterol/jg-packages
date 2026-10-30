import { expect, test } from 'vitest';

import { DEFAULT_UI_PREFERENCES, UiPreferencesSchema } from './index.js';

test('the persisted contract retains every preference and its ISO dismissal timestamp', () => {
  const preferences = {
    theme: 'dark',
    codeDiffView: 'unified',
    prefersWrappedCode: true,
    appInstallToastrDismissedAt: '2026-10-30T00:00:00.000Z',
  };
  expect(UiPreferencesSchema.parse(preferences)).toStrictEqual(preferences);
  expect(UiPreferencesSchema.parse(DEFAULT_UI_PREFERENCES)).toStrictEqual({
    theme: 'system',
    codeDiffView: 'split',
    prefersWrappedCode: false,
    appInstallToastrDismissedAt: null,
  });
  expect(
    UiPreferencesSchema.safeParse({ ...preferences, appInstallToastrDismissedAt: 1793318400000 })
      .success,
  ).toBe(false);
  expect(UiPreferencesSchema.safeParse({ theme: 'dark' }).success).toBe(false);
});
