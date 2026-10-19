import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { useCopyFeedback } from './copy-feedback.hook.js';
import type { IUseCopyFeedbackOptions } from './types.js';

/**
 * Renders a component that shows the hook's state on the server.
 * @param options The hook's options.
 * @returns The markup.
 */
const renderCopyState = (options?: IUseCopyFeedbackOptions): string =>
  renderToString(
    createElement(() => {
      const { isCopied } = useCopyFeedback(options);
      return createElement('span', null, isCopied ? 'Copied' : 'Copy');
    }),
  );

describe('useCopyFeedback', () => {
  test('renders not copied on the server, with no window to read', () => {
    expect(renderCopyState()).toBe('<span>Copy</span>');
    expect(renderCopyState({ durationSeconds: 0.5 })).toBe('<span>Copy</span>');
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '2'])(
    'throws INVALID_COPY_FEEDBACK_DURATION for a duration of %s',
    (durationSeconds) => {
      expectToThrowCode(
        () => renderCopyState({ durationSeconds: durationSeconds as number }),
        ERRORS.INVALID_COPY_FEEDBACK_DURATION,
        'The copy feedback duration must be a positive, finite number of seconds.',
      );
    },
  );
});
