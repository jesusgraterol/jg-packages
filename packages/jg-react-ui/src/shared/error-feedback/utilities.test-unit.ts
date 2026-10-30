import { expect, test } from 'vitest';

import { createErrorFeedback, Exception } from 'jg-exception';

import { resolveErrorFeedbackSafely } from './index.js';

test('unknown messages and codes remain private with generic operation-specific copy', () => {
  expect(
    resolveErrorFeedbackSafely(new Exception('private diagnostic', { code: 'INTERNAL_ONLY' }), {
      fallbackMessage: 'Unable to save.',
    }),
  ).toStrictEqual({
    message: 'Unable to save.',
    code: null,
    isCancelled: false,
    isAccessDenied: false,
  });
});

test('an application policy supplies authored messages and access-loss classification', () => {
  const resolver = createErrorFeedback({
    fallbackMessage: 'Try again.',
    messagesByCode: { SESSION_CLOSED: 'Please sign in again.' },
    accessDeniedCodes: ['SESSION_CLOSED'],
  });
  expect(
    resolveErrorFeedbackSafely(
      new Exception('private', { code: 'SESSION_CLOSED' }),
      undefined,
      resolver,
    ),
  ).toStrictEqual({
    message: 'Please sign in again.',
    code: 'SESSION_CLOSED',
    isCancelled: false,
    isAccessDenied: true,
  });
});

test('a throwing application policy falls back without leaking its failure', () => {
  expect(
    resolveErrorFeedbackSafely(new Error('private'), undefined, () => {
      throw new Error('resolver diagnostics');
    }),
  ).toStrictEqual({
    message: 'Something went wrong. Please try again.',
    code: null,
    isCancelled: false,
    isAccessDenied: false,
  });
});

test('cancellation remains recognized even if application policy would classify it as a normal failure', () => {
  expect(
    resolveErrorFeedbackSafely(
      new DOMException('private cancellation', 'AbortError'),
      undefined,
      () => ({
        message: 'Do not show this.',
        code: 'APP_FAILURE',
        isCancelled: false,
        isAccessDenied: true,
      }),
    ),
  ).toStrictEqual({
    message: 'Something went wrong. Please try again.',
    code: null,
    isCancelled: true,
    isAccessDenied: false,
  });
});
