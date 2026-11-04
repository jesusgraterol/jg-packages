import { act, cleanup, renderHook } from '@testing-library/react';
import { expectToThrowCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { useCurrentTime } from './current-time.hook.js';

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z') });
});

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  vi.useRealTimers();
});

describe('useCurrentTime', () => {
  test('moves the time on once a minute by default, re-rendering only then', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useCurrentTime();
    });
    const start = Date.parse('2026-01-01T00:00:00.000Z');
    expect(result.current).toBe(start);
    const rendersBefore = renders;

    act(() => {
      vi.advanceTimersByTime(59_999);
    });
    expect(renders).toBe(rendersBefore);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(start + 60_000);
    expect(renders).toBe(rendersBefore + 1);
  });

  test('follows a new interval, and stops once unmounted', () => {
    const { result, rerender, unmount } = renderHook(
      ({ intervalSeconds }: { intervalSeconds: number }) => useCurrentTime({ intervalSeconds }),
      { initialProps: { intervalSeconds: 60 } },
    );
    const start = result.current;

    rerender({ intervalSeconds: 5 });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toBe(start + 5_000);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each([[0], [-1], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'useCurrentTime({ intervalSeconds: %s }) -> throws',
    (intervalSeconds) => {
      expectToThrowCode(
        () => renderHook(() => useCurrentTime({ intervalSeconds })),
        ERRORS.INVALID_CURRENT_TIME_INTERVAL,
        "The current time's interval must be a positive, finite number of seconds.",
      );
    },
  );
});
