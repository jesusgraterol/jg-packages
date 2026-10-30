import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';

import { ThemeProvider } from '../theme-provider/index.js';
import { Toastr } from './index.js';

test('toast hosting renders on the server without browser globals or a portal', () => {
  expect(() =>
    renderToString(
      <ThemeProvider>
        <Toastr />
      </ThemeProvider>,
    ),
  ).not.toThrow();
});
