import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';

import { Button } from './index.js';

test.each([
  undefined,
  'Save',
  [createElement('a', { key: 'a' }), createElement('a', { key: 'b' })],
])('Button rejects an invalid asChild element: %o', { tags: ['full'] }, (children) => {
  expect(() => renderToString(createElement(Button, { asChild: true }, children))).toThrow(
    'Button asChild requires exactly one valid React element child.',
  );
});

test('Button can be rendered on the server without browser globals', { tags: ['full'] }, () => {
  expect(renderToString(createElement(Button, { badgeCount: 12 }, 'Notifications'))).toContain(
    '9+',
  );
});
