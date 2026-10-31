import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';

import { ChatMarkdownEditor } from './chat-editor.component.js';

test.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'rejects an invalid serialized message limit %s before editor initialization',
  (maxLength) => {
    expect(() =>
      renderToString(
        <ChatMarkdownEditor
          maxLength={maxLength}
          onChange={() => {}}
          value=""
        />,
      ),
    ).toThrow('ChatMarkdownEditor maxLength must be a positive safe integer.');
  },
);

test.each([0, -1, NaN, Infinity])(
  'rejects an invalid editor height %s before editor initialization',
  (maxEditorHeight) => {
    expect(() =>
      renderToString(
        <ChatMarkdownEditor
          maxEditorHeight={maxEditorHeight}
          maxLength={2048}
          onChange={() => {}}
          value=""
        />,
      ),
    ).toThrow('ChatMarkdownEditor maxEditorHeight must be a positive finite number.');
  },
);

test('server rendering retains the accessible count and value without creating a DOM editor', () => {
  const markup = renderToString(
    <ChatMarkdownEditor
      maxLength={4}
      onChange={() => {}}
      value="Too long"
    />,
  );
  expect(markup).toContain('The message is longer than the allowed limit.');
  expect(markup).toContain('8<!-- -->/<!-- -->4');
  expect(markup).not.toContain('contenteditable');
});
