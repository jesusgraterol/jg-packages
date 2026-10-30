import { cleanup, render } from '@testing-library/react';
import { createElement, Fragment } from 'react';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { useUiPreferencesStore } from './store.hook.js';

afterEach(cleanup);

test('the unprovided store ignores direct mutation requests and keeps its read-only fallback', async () => {
  const Reader = () => {
    const preferences = useUiPreferencesStore((state) => state.uiPreferences);
    const setPreferences = useUiPreferencesStore((state) => state.setUiPreferences);
    return createElement(
      Fragment,
      null,
      createElement('output', { 'aria-label': 'Fallback theme' }, preferences.theme),
      createElement(
        'button',
        { onClick: () => setPreferences({ ...preferences, theme: 'dark' }) },
        'Request fallback change',
      ),
    );
  };
  render(createElement(Reader));
  await page.getByRole('button', { name: 'Request fallback change' }).click();
  await expect.element(page.getByLabelText('Fallback theme')).toHaveTextContent('system');
});
