import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { ErrorFeedbackProvider, useErrorFeedbackResolver } from './index.js';

const ErrorNotice = () => useErrorFeedbackResolver()(new Error('private diagnostics')).message;

test('scoped default error feedback renders safely without browser globals', () => {
  expect(
    renderToStaticMarkup(
      createElement(ErrorFeedbackProvider, { children: createElement(ErrorNotice) }),
    ),
  ).toBe('Something went wrong. Please try again.');
});
