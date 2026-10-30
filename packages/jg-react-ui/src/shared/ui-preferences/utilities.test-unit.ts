import { expect, test } from 'vitest';

import { DEFAULT_UI_PREFERENCES } from '../../contracts/index.js';

import { areUiPreferencesEqual, normalizeUiPreferences } from './index.js';

test.each([undefined, null, 'invalid JSON record', [], 4])(
  'normalization falls back for malformed records: %o',
  (input) => {
    expect(normalizeUiPreferences(input)).toStrictEqual(DEFAULT_UI_PREFERENCES);
  },
);

test('partial and invalid fields preserve their per-field defaults without losing valid preferences', () => {
  expect(
    normalizeUiPreferences({
      theme: 'dark',
      codeDiffView: 'unexpected',
      prefersWrappedCode: true,
      appInstallToastrDismissedAt: 'not-a-date',
    }),
  ).toStrictEqual({
    theme: 'dark',
    codeDiffView: 'split',
    prefersWrappedCode: true,
    appInstallToastrDismissedAt: null,
  });
});

test('complete values preserve timestamp, false, and nullable source semantics', () => {
  const preferences = {
    theme: 'light',
    codeDiffView: 'unified',
    prefersWrappedCode: false,
    appInstallToastrDismissedAt: '2026-10-30T00:00:00.000Z',
  } as const;
  expect(normalizeUiPreferences(preferences)).toStrictEqual(preferences);
  expect(
    normalizeUiPreferences({ appInstallToastrDismissedAt: null }, preferences)
      .appInstallToastrDismissedAt,
  ).toBeNull();
});

test.each(['theme', 'codeDiffView', 'prefersWrappedCode', 'appInstallToastrDismissedAt'] as const)(
  'snapshot comparison observes the %s field',
  (field) => {
    const first = { ...DEFAULT_UI_PREFERENCES };
    const second = {
      theme: 'dark',
      codeDiffView: 'unified',
      prefersWrappedCode: true,
      appInstallToastrDismissedAt: '2026-10-30T00:00:00.000Z',
    } as const;
    expect(areUiPreferencesEqual(first, first)).toBe(true);
    expect(areUiPreferencesEqual(first, { ...first, [field]: second[field] })).toBe(false);
  },
);
