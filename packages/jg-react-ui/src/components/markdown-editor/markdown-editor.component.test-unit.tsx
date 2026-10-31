import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';

import { CompactMarkdownEditor, MarkdownEditor, WideMarkdownEditor } from './index.js';

test.each([MarkdownEditor, CompactMarkdownEditor, WideMarkdownEditor])(
  '%s renders a server fallback without creating a DOM editor',
  (Component) => {
    const html = renderToString(
      <Component
        onChange={() => {}}
        value="Retained draft"
      />,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('contenteditable');
    expect(typeof document).toBe('undefined');
  },
);

test('the server loading state preserves disabled and accessible description props', () => {
  const html = renderToString(
    <MarkdownEditor
      aria-describedby="help"
      aria-label="Project notes"
      disabled
      onChange={() => {}}
      value=""
    />,
  );
  expect(html).toContain('data-disabled="true"');
  expect(html).toContain('aria-describedby="help"');
  expect(html).toContain('aria-label="Project notes"');
});
