import { expect, test } from 'vitest';
import { expectToThrowCode } from 'jg-exception/testing';

import { ERRORS } from '../errors/index.js';

import { getUiPreferencesStorageKey, UI_PREFERENCES_STORAGE_KEY } from './index.js';

const MESSAGE =
  'UI preferences storage ID must be a non-empty string containing only letters, digits, underscores, and hyphens.';

test.each([
  '',
  ' hq',
  'hq ',
  'hq.preferences',
  'hq:preferences',
  'hq/preferences',
  'hq\npreferences',
  '</script>',
])('invalid storage ID fails before key creation: %s', (storageId) => {
  expectToThrowCode(
    () => getUiPreferencesStorageKey(storageId),
    ERRORS.UI_PREFERENCES_STORAGE_ID_INVALID,
    MESSAGE,
  );
});

test.each([
  ['personal-hq', 'jg-storage:personal-hq'],
  ['HQ_1', 'jg-storage:HQ_1'],
])('storage namespace %s has the documented raw key', (storageId, expected) => {
  expect(getUiPreferencesStorageKey(storageId)).toBe(expected);
});

test('the legacy default constant matches the shared key derivation', () => {
  expect(getUiPreferencesStorageKey()).toBe('jg-storage:jg-ui-preferences');
  expect(getUiPreferencesStorageKey()).toBe(UI_PREFERENCES_STORAGE_KEY);
});

test('JavaScript callers cannot pass non-string namespaces', () => {
  expectToThrowCode(
    () => {
      // @ts-expect-error verifies the JavaScript boundary as well as its TypeScript contract
      getUiPreferencesStorageKey(null);
    },
    ERRORS.UI_PREFERENCES_STORAGE_ID_INVALID,
    MESSAGE,
  );
});
