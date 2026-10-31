import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import { expectToThrowCode } from 'jg-exception/testing';

import { DEFAULT_UI_PREFERENCES } from '../../contracts/index.js';
import { ERRORS } from '../../errors/index.js';

import { UiPreferencesProvider, useUiPreferences } from './index.js';

const Snapshot = () => JSON.stringify(useUiPreferences().preferences);

test('the initial server snapshot is provider-local and requires no browser storage', () => {
  const preferences = { ...DEFAULT_UI_PREFERENCES, theme: 'dark' } as const;
  const markup = renderToStaticMarkup(
    createElement(UiPreferencesProvider, {
      mode: 'local',
      initialPreferences: preferences,
      storageId: 'server-root',
      children: createElement(Snapshot),
    }),
  );
  expect(markup).toContain('&quot;theme&quot;:&quot;dark&quot;');
});

test('invalid namespaces fail during render before browser APIs are needed', () => {
  const storageAccess = vi.fn(() => {
    throw new Error('Storage must not be accessed');
  });
  vi.stubGlobal('window', Object.defineProperty({}, 'localStorage', { get: storageAccess }));
  expectToThrowCode(
    () =>
      renderToStaticMarkup(
        createElement(UiPreferencesProvider, {
          mode: 'local',
          storageId: 'invalid.namespace',
          children: 'App',
        }),
      ),
    ERRORS.UI_PREFERENCES_STORAGE_ID_INVALID,
    'UI preferences storage ID must be a non-empty string containing only letters, digits, underscores, and hyphens.',
  );
  expect(storageAccess).not.toHaveBeenCalled();
});
