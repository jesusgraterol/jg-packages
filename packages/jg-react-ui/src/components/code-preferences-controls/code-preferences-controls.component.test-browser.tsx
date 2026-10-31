import { act } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { page } from 'vitest/browser';
import { afterEach, expect, test, vi } from 'vitest';

import { DEFAULT_UI_PREFERENCES } from '../../contracts/index.js';
import { UiPreferencesProvider, useUiPreferences } from '../ui-preferences-provider/index.js';
import { CodePreferencesControls } from './index.js';

const PreferencesSurface = () => {
  const { preferences, canUpdatePreferences } = useUiPreferences();
  return (
    <>
      <CodePreferencesControls
        canChangeCodeDiffView={canUpdatePreferences}
        canChangePrefersWrappedCode={canUpdatePreferences}
        codeDiffView={preferences.codeDiffView}
        prefersWrappedCode={preferences.prefersWrappedCode}
      />
      <output aria-label="Saved code preferences">{`${preferences.codeDiffView}:${String(preferences.prefersWrappedCode)}`}</output>
    </>
  );
};

afterEach(() => {
  cleanup();
  localStorage.removeItem('jg-ui-preferences');
  vi.restoreAllMocks();
});

test('read-only capabilities omit mutation controls', () => {
  render(
    <UiPreferencesProvider mode="read-only">
      <PreferencesSurface />
    </UiPreferencesProvider>,
  );
  expect(screen.queryByRole('button')).toBeNull();
});

test('code menus preserve unchanged values and persist both source preferences', async () => {
  const persistPreferences = vi.fn().mockResolvedValue(undefined);
  render(
    <UiPreferencesProvider
      mode="remote"
      initialPreferences={DEFAULT_UI_PREFERENCES}
      persistPreferences={persistPreferences}
    >
      <PreferencesSurface />
    </UiPreferencesProvider>,
  );
  const openDiff = async (name: string) => {
    await act(async () => {
      await page.getByRole('button', { name }).click();
    });
  };
  const choose = async (role: 'menuitemcheckbox' | 'menuitemradio', name: string) => {
    await act(async () => {
      await page.getByRole(role, { name, exact: true }).click();
    });
  };
  await openDiff('Code diff view: Split');
  await choose('menuitemcheckbox', 'Split');
  expect(persistPreferences).not.toHaveBeenCalled();
  await openDiff('Code diff view: Split');
  await choose('menuitemcheckbox', 'Unified');
  expect(screen.getByLabelText('Saved code preferences').textContent).toBe('unified:false');
  await openDiff('Code diff view: Unified');
  await choose('menuitemcheckbox', 'Unified');
  expect(persistPreferences).toHaveBeenCalledTimes(1);
  await openDiff('Code diff view: Unified');
  await choose('menuitemcheckbox', 'Split');
  await openDiff('Line wrapping: Scroll');
  await choose('menuitemradio', 'Wrap lines');
  expect(screen.getByLabelText('Saved code preferences').textContent).toBe('split:true');
  await openDiff('Line wrapping: Wrap');
  await choose('menuitemradio', 'Scroll horizontally');
  expect(screen.getByLabelText('Saved code preferences').textContent).toBe('split:false');
  expect(persistPreferences.mock.calls.at(-1)?.[0]).toStrictEqual(DEFAULT_UI_PREFERENCES);
});

test('inline diff-only controls retain their compact presentation and omit wrapping', () => {
  render(
    <UiPreferencesProvider mode="local">
      <CodePreferencesControls
        canChangeCodeDiffView
        isInline
        prefersWrappedCode={false}
      />
    </UiPreferencesProvider>,
  );
  expect(screen.getByRole('button', { name: 'Code diff view: Split' })).not.toBeNull();
  expect(screen.queryByRole('button', { name: /Line wrapping/ })).toBeNull();
});
