import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';

import { Progress } from './index.js';

afterEach(cleanup);

test.each([
  [undefined, undefined, 100, 0],
  [10, 20, 20, 10],
  [-2, 20, 20, 0],
  [30, 20, 20, 20],
  [Number.NaN, -1, 100, 0],
  [Number.POSITIVE_INFINITY, Number.NaN, 100, 0],
  [2, Number.POSITIVE_INFINITY, 100, 2],
  [2, 0, 100, 2],
])(
  'Progress(value=%s, max=%s) exposes max=%s and current=%s',
  (value, max, expectedMax, expectedValue) => {
    render(
      <Progress
        aria-label="Upload"
        {...(value === undefined ? {} : { value })}
        {...(max === undefined ? {} : { max })}
      />,
    );
    const progress = screen.getByRole('progressbar', { name: 'Upload' });
    expect(progress.getAttribute('aria-valuemax')).toBe(String(expectedMax));
    expect(progress.getAttribute('aria-valuenow')).toBe(String(expectedValue));
    expect(progress.getAttribute('aria-valuemin')).toBe('0');
  },
);

test('Progress announces an indeterminate operation without inventing completion', () => {
  render(
    <Progress
      indeterminate
      aria-label="Connecting"
    />,
  );
  const progress = screen.getByRole('progressbar', { name: 'Connecting' });
  expect(progress.hasAttribute('aria-valuenow')).toBe(false);
  expect(progress.hasAttribute('data-indeterminate')).toBe(true);
});
