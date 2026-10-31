import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { CopyButton } from './index.js';

test('CopyButton renders ready feedback without browser globals', () => {
  const html = renderToStaticMarkup(<CopyButton value="server-rendered" />);
  expect(html).toContain('aria-label="Copy to Clipboard"');
  expect(html).toContain('data-copied="false"');
  expect(html).not.toContain('server-rendered');
});

test('CopyButton retains the inherited Button slotted-child guard', () => {
  expect(() =>
    renderToStaticMarkup(
      <CopyButton
        asChild
        value="value"
      />,
    ),
  ).toThrow('Button asChild requires exactly one valid React element child.');
});
