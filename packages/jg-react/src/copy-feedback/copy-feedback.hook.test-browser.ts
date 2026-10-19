import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { DEFAULT_COPY_FEEDBACK_SECONDS } from './constants.js';
import { useCopyFeedback } from './copy-feedback.hook.js';
import type { IUseCopyFeedbackOptions } from './types.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * Renders the hook with its options as props, so a test can change them.
 * @param options The hook's options.
 * @returns The rendered hook.
 */
const renderCopyFeedback = (options: IUseCopyFeedbackOptions = {}) =>
  renderHook((props: IUseCopyFeedbackOptions) => useCopyFeedback(props), {
    initialProps: options,
  });

/**
 * Creates a promise the test settles.
 * @returns The promise and its resolve and reject functions.
 */
const createDeferred = (): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
} => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

describe('useCopyFeedback', () => {
  test('shows the copy as copied for the default duration, then resets', async () => {
    vi.useFakeTimers();
    const write = vi.fn(() => Promise.resolve());
    const { result } = renderCopyFeedback();
    const { copy } = result.current;

    let isSuccess: boolean | undefined;
    await act(async () => {
      isSuccess = await result.current.copy(write);
    });

    expect(isSuccess).toBe(true);
    expect(result.current.isCopied).toBe(true);
    expect(result.current.copy).toBe(copy);

    act(() => {
      vi.advanceTimersByTime(DEFAULT_COPY_FEEDBACK_SECONDS * 1000 - 1);
    });
    expect(result.current.isCopied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.isCopied).toBe(false);
  });

  test('restarts the copied state for a later copy', async () => {
    vi.useFakeTimers();
    const { result } = renderCopyFeedback({ durationSeconds: 1 });

    await act(async () => {
      await result.current.copy(() => undefined);
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    await act(async () => {
      await result.current.copy(() => undefined);
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(result.current.isCopied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.isCopied).toBe(false);
  });

  test('ignores a copy while another runs', async () => {
    const pending = createDeferred();
    const write = vi.fn(() => pending.promise);
    const { result } = renderCopyFeedback();

    let first: Promise<boolean> | undefined;
    let second: boolean | undefined;
    await act(async () => {
      first = result.current.copy(write);
      second = await result.current.copy(write);
    });

    expect(second).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve();
      await first;
    });
    expect(result.current.isCopied).toBe(true);
    await act(async () => {
      await result.current.copy(write);
    });
    expect(write).toHaveBeenCalledTimes(2);
  });

  test('resolves to false and calls the latest onError when the write fails, without rejecting', async () => {
    const failure = new Error('The clipboard refused the write.');
    const firstOnError = vi.fn();
    const latestOnError = vi.fn();
    const { result, rerender } = renderCopyFeedback({ onError: firstOnError });
    const { copy } = result.current;
    rerender({ onError: latestOnError });

    let isSuccess: boolean | undefined;
    await act(async () => {
      isSuccess = await result.current.copy(() => Promise.reject(failure));
    });

    expect(isSuccess).toBe(false);
    expect(result.current.isCopied).toBe(false);
    expect(result.current.copy).toBe(copy);
    expect(firstOnError).not.toHaveBeenCalled();
    expect(latestOnError).toHaveBeenCalledWith(failure);
  });

  test('calls write before awaiting anything, and treats a write that throws as a failure', async () => {
    const onError = vi.fn();
    const failure = new Error('No clipboard.');
    const { result } = renderCopyFeedback({ onError });
    const write = vi.fn(() => Promise.resolve());

    let pending: Promise<boolean> | undefined;
    act(() => {
      pending = result.current.copy(write);
      // still inside the same call: no microtask has run since copy was called
      expect(write).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await pending;
    });

    let isSuccess: boolean | undefined;
    await act(async () => {
      isSuccess = await result.current.copy(() => {
        throw failure;
      });
    });
    expect(isSuccess).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure);
  });

  test('changes nothing and calls nothing when a copy settles after unmount', async () => {
    const onError = vi.fn();
    const succeeding = createDeferred();
    const failing = createDeferred();
    const { result, unmount } = renderCopyFeedback({ onError });
    const { copy } = result.current;
    let succeeded: Promise<boolean> | undefined;
    act(() => {
      succeeded = copy(() => succeeding.promise);
    });

    unmount();
    succeeding.resolve();
    await expect(succeeded).resolves.toBe(true);

    const second = renderCopyFeedback({ onError });
    let failed: Promise<boolean> | undefined;
    act(() => {
      failed = second.result.current.copy(() => failing.promise);
    });
    second.unmount();
    failing.reject(new Error('Too late.'));
    await expect(failed).resolves.toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  test('stops the reset timer on unmount, and copies nothing afterwards', async () => {
    vi.useFakeTimers();
    const clearTimeout = vi.spyOn(window, 'clearTimeout');
    const { result, unmount } = renderCopyFeedback();
    await act(async () => {
      await result.current.copy(() => undefined);
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(clearTimeout).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    const write = vi.fn();
    await expect(result.current.copy(write)).resolves.toBe(false);
    expect(write).not.toHaveBeenCalled();
  });
});
