import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from '@playwright/test';

import { expectToThrowCode } from 'jg-exception/testing';
import { ERRORS, ThemeInitializationScript, useTheme } from 'jg-personal-react-ui';

const MissingTheme = () => useTheme().resolvedTheme;

test(
  'personal entries preserve owned errors through the shared theme implementation',
  { tag: '@full' },
  () => {
    expectToThrowCode(
      () => renderToStaticMarkup(createElement(MissingTheme)),
      ERRORS.THEME_PROVIDER_MISSING,
      'useTheme must be used within a ThemeProvider',
    );
    expectToThrowCode(
      () =>
        renderToStaticMarkup(
          createElement(ThemeInitializationScript, { storageId: 'invalid.namespace' }),
        ),
      ERRORS.UI_PREFERENCES_STORAGE_ID_INVALID,
      'UI preferences storage ID must be a non-empty string containing only letters, digits, underscores, and hyphens.',
    );
  },
);
