import { renderToStaticMarkup } from 'react-dom/server';
import { expectToThrowCode } from 'jg-exception/testing';
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

test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  'CopyButton(copiedFeedbackDuration %s) -> INVALID_COPY_FEEDBACK_DURATION',
  (copiedFeedbackDuration) => {
    expectToThrowCode(
      () =>
        renderToStaticMarkup(
          <CopyButton
            copiedFeedbackDuration={copiedFeedbackDuration}
            value="value"
          />,
        ),
      'INVALID_COPY_FEEDBACK_DURATION',
      'The copy feedback duration must be a positive, finite number of seconds.',
    );
  },
);
