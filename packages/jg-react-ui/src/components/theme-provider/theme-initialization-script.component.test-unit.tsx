import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { expectToThrowCode } from 'jg-exception/testing';

import { ERRORS } from '../../errors/index.js';

import { ThemeInitializationScript, useTheme } from './index.js';

const MissingTheme = () => useTheme().resolvedTheme;

test('the pre-paint script is deterministic and carries the namespace, identity, and nonce', () => {
  const props = { storageId: 'custom-hq', id: 'theme-init', nonce: 'example-nonce' };
  const first = renderToStaticMarkup(createElement(ThemeInitializationScript, props));
  expect(first).toBe(renderToStaticMarkup(createElement(ThemeInitializationScript, props)));
  expect(first).toContain('jg-storage:custom-hq');
  expect(first).toContain('id="theme-init"');
  expect(first).toContain('nonce="example-nonce"');
});

test('invalid namespaces fail before script generation', () => {
  expectToThrowCode(
    () =>
      renderToStaticMarkup(
        createElement(ThemeInitializationScript, { storageId: 'invalid.namespace' }),
      ),
    ERRORS.UI_PREFERENCES_STORAGE_ID_INVALID,
    'UI preferences storage ID must be a non-empty string containing only letters, digits, underscores, and hyphens.',
  );
});

test('useTheme retains the source missing-provider error', () => {
  expectToThrowCode(
    () => renderToStaticMarkup(createElement(MissingTheme)),
    ERRORS.THEME_PROVIDER_MISSING,
    'useTheme must be used within a ThemeProvider',
  );
});
