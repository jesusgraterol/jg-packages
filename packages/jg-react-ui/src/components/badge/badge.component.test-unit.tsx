import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { Badge } from './index.js';

test.each([
  undefined,
  'Status',
  [createElement('span', { key: 'a' }), createElement('span', { key: 'b' })],
])('Badge rejects invalid slotted children: %o', (children) => {
  expect(() => renderToStaticMarkup(createElement(Badge, { asChild: true }, children))).toThrow(
    'asChild requires exactly one valid React element child.',
  );
});

test('Badge supports SSR with the retained defaults', () => {
  const markup = renderToStaticMarkup(<Badge>Ready</Badge>);
  expect(markup).toContain('data-variant="default"');
  expect(markup).toContain('>Ready</span>');
});
