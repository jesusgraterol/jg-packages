import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { createErrorFeedback, Exception } from 'jg-exception';

import type { IErrorFeedbackResolver } from '../../contracts/index.js';

import { ErrorFeedbackProvider, useErrorFeedbackResolver } from './index.js';

afterEach(cleanup);

const FAILURE = new Exception('private backend diagnostics', { code: 'APP_FAILURE' });
const firstResolver = createErrorFeedback({ fallbackMessage: 'First app.' });
const secondResolver = createErrorFeedback({ fallbackMessage: 'Second app.' });
const Probe = ({ label }: { label: string }) => {
  const resolveErrorFeedback = useErrorFeedbackResolver();
  return <output aria-label={label}>{resolveErrorFeedback(FAILURE).message}</output>;
};

test('separate roots and nested providers keep their policies isolated', () => {
  render(
    <ErrorFeedbackProvider resolveErrorFeedback={firstResolver}>
      <Probe label="First" />
      <ErrorFeedbackProvider resolveErrorFeedback={secondResolver}>
        <Probe label="Nested" />
      </ErrorFeedbackProvider>
    </ErrorFeedbackProvider>,
  );
  render(<Probe label="Default" />);
  expect(screen.getByLabelText('First').textContent).toBe('First app.');
  expect(screen.getByLabelText('Nested').textContent).toBe('Second app.');
  expect(screen.getByLabelText('Default').textContent).toBe(
    'Something went wrong. Please try again.',
  );
});

test('resolver identity stays stable on unrelated renders and updates when the policy changes', () => {
  const observed: IErrorFeedbackResolver[] = [];
  const Observe = () => {
    const resolver = useErrorFeedbackResolver();
    observed.push(resolver);
    return null;
  };
  const { rerender } = render(
    <ErrorFeedbackProvider resolveErrorFeedback={firstResolver}>
      <Observe />
    </ErrorFeedbackProvider>,
  );
  const initial = observed.at(-1);
  rerender(
    <ErrorFeedbackProvider resolveErrorFeedback={firstResolver}>
      <Observe />
    </ErrorFeedbackProvider>,
  );
  expect(observed.at(-1)).toBe(initial);
  rerender(
    <ErrorFeedbackProvider resolveErrorFeedback={secondResolver}>
      <Observe />
    </ErrorFeedbackProvider>,
  );
  expect(observed.at(-1)).not.toBe(initial);
  expect(observed.at(-1)?.(FAILURE).message).toBe('Second app.');
});
