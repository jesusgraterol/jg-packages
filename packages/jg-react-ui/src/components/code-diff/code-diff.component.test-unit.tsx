import { renderToString } from 'react-dom/server';
import { expectToThrowCode } from 'jg-exception/testing';
import { test } from 'vitest';

import { ERRORS } from '../../errors/index.js';

import { CodeDiff } from './index.js';

test('CodeDiff exposes the documented missing-theme-provider contract', () => {
  expectToThrowCode(
    () =>
      renderToString(
        <CodeDiff
          oldValue="before"
          newValue="after"
        />,
      ),
    ERRORS.THEME_PROVIDER_MISSING,
    'useTheme must be used within a ThemeProvider',
  );
});
