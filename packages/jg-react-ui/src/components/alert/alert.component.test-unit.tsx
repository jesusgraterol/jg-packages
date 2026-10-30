import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { Alert, AlertTitle } from './index.js';

test.each([
  undefined,
  'Notice',
  [createElement('span', { key: 'a' }), createElement('span', { key: 'b' })],
])('Alert rejects invalid slotted children: %o', (children) => {
  expect(() => renderToStaticMarkup(createElement(Alert, { asChild: true }, children))).toThrow(
    'asChild requires exactly one valid React element child.',
  );
});

test('Alert supports SSR without browser globals', () => {
  const markup = renderToStaticMarkup(
    <Alert>
      <AlertTitle>Saved</AlertTitle>
    </Alert>,
  );
  expect(markup).toContain('role="alert"');
  expect(markup).toContain('>Saved</span>');
});
