import { expect, test, vi } from 'vitest';

import { DEFAULT_UI_PREFERENCES } from '../../contracts/index.js';

import { createUiPreferencesStore } from './index.js';

test('independent stores keep root state isolated and start from the supplied snapshot', () => {
  const first = createUiPreferencesStore({ ...DEFAULT_UI_PREFERENCES, theme: 'dark' });
  const second = createUiPreferencesStore();
  first
    .getState()
    .setUiPreferences({ ...first.getState().uiPreferences, prefersWrappedCode: true });
  expect(first.getState().uiPreferences).toStrictEqual({
    ...DEFAULT_UI_PREFERENCES,
    theme: 'dark',
    prefersWrappedCode: true,
  });
  expect(second.getState().uiPreferences).toStrictEqual(DEFAULT_UI_PREFERENCES);
});

test('equivalent snapshots preserve selector identity and do not notify subscribers', () => {
  const store = createUiPreferencesStore();
  const before = store.getState();
  const subscriber = vi.fn();
  const unsubscribe = store.subscribe(subscriber);
  store.getState().setUiPreferences({ ...DEFAULT_UI_PREFERENCES });
  expect(store.getState()).toBe(before);
  expect(subscriber).not.toHaveBeenCalled();
  unsubscribe();
});
