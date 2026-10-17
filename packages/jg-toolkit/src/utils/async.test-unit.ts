// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToRejectCode } from 'jg-exception/testing';

import { delay, retryAsyncFunction, waitUntil } from './async.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('delay', () => {
  test('can delay the execution of a function for any number of seconds', async () => {
    vi.useFakeTimers();
    const mockFn = vi.fn();
    void delay(10).then(mockFn);
    expect(mockFn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    expect(mockFn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(6000);
    expect(mockFn).toHaveBeenCalledOnce();
  });

  test('rejects with the reason when the signal is already aborted', async () => {
    vi.useFakeTimers();
    const reason = new Error('Stopped');

    await expect(delay(10, { signal: AbortSignal.abort(reason) })).rejects.toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('rejects with the reason when the signal aborts during the wait', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const reason = new Error('Stopped');
    const assertion = expect(delay(10, { signal: controller.signal })).rejects.toBe(reason);

    await vi.advanceTimersByTimeAsync(5000);
    controller.abort(reason);

    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  test('resolves after the delay when the signal never aborts', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const mockFn = vi.fn();
    void delay(2, { signal: controller.signal }).then(mockFn);

    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFn).toHaveBeenCalledOnce();
    controller.abort();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('retryAsyncFunction', () => {
  test('can invoke a function persistently until its out of attempts (w/ delay)', async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('This is an error!'))
      .mockRejectedValueOnce(new Error('This is an error!'))
      .mockResolvedValueOnce(undefined);
    void retryAsyncFunction(fn, [3, 5]);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2100);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(5500);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('can invoke a function persistently until its out of attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('This is an error!'));
    await expect(retryAsyncFunction(fn, [0, 0])).rejects.toThrow('This is an error!');
    expect(fn).toHaveBeenNthCalledWith(1);
    expect(fn).toHaveBeenNthCalledWith(2);
    expect(fn).toHaveBeenNthCalledWith(3);
  });

  test('can invoke a function persistently until its out of attempts with args', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('This is an error!'));
    const args = ['abc', 1, true, [1, 2], { foo: 'bar' }];
    await expect(
      retryAsyncFunction(() => fn(...args) as Promise<unknown>, [0, 0, 0]),
    ).rejects.toThrow('This is an error!');
    expect(fn).toHaveBeenNthCalledWith(1, ...args);
    expect(fn).toHaveBeenNthCalledWith(2, ...args);
    expect(fn).toHaveBeenNthCalledWith(3, ...args);
    expect(fn).toHaveBeenNthCalledWith(4, ...args);
  });

  test('can invoke a function persistently until it resolves', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('This is an error!'))
      .mockRejectedValueOnce(new Error('This is an error!'))
      .mockResolvedValueOnce(undefined);
    await expect(retryAsyncFunction(fn, [0, 0])).resolves.toBeUndefined();
    expect(fn).toHaveBeenNthCalledWith(1);
    expect(fn).toHaveBeenNthCalledWith(2);
    expect(fn).toHaveBeenNthCalledWith(3);
  });

  test('can invoke a function persistently until it resolves a value', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('This is an error!'))
      .mockResolvedValueOnce('Hello World!');
    await expect(retryAsyncFunction(fn, [0, 0])).resolves.toBe('Hello World!');
    expect(fn).toHaveBeenNthCalledWith(1);
    expect(fn).toHaveBeenNthCalledWith(2);
  });

  test('can invoke a function persistently until it resolves with args', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('This is an error!'))
      .mockRejectedValueOnce(new Error('This is an error!'))
      .mockResolvedValueOnce(undefined);
    const args = ['abc', 1, true, [1, 2], { foo: 'bar' }];
    await expect(
      retryAsyncFunction(() => fn(...args) as Promise<unknown>, [0, 0]),
    ).resolves.toBeUndefined();
    expect(fn).toHaveBeenNthCalledWith(1, ...args);
    expect(fn).toHaveBeenNthCalledWith(2, ...args);
    expect(fn).toHaveBeenNthCalledWith(3, ...args);
  });
});

describe('retryAsyncFunction with options', () => {
  test('rejects with the reason without calling the function when the signal is aborted', async () => {
    const fn = vi.fn().mockResolvedValue('Hello World!');
    const reason = new Error('Stopped');

    await expect(retryAsyncFunction(fn, [0], { signal: AbortSignal.abort(reason) })).rejects.toBe(
      reason,
    );
    expect(fn).not.toHaveBeenCalled();
  });

  test('rejects with the reason while an attempt never settles', async () => {
    const controller = new AbortController();
    const reason = new Error('Stopped');
    const fn = vi.fn(() => new Promise<string>(() => {}));
    const assertion = expect(
      retryAsyncFunction(fn, [3], { signal: controller.signal }),
    ).rejects.toBe(reason);

    controller.abort(reason);

    await assertion;
    expect(fn).toHaveBeenCalledOnce();
  });

  test('rejects with the reason when the signal aborts between attempts', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const reason = new Error('Stopped');
    const fn = vi.fn().mockRejectedValue(new Error('This is an error!'));
    const assertion = expect(
      retryAsyncFunction(fn, [10, 10], { signal: controller.signal }),
    ).rejects.toBe(reason);

    await vi.advanceTimersByTimeAsync(1000);
    controller.abort(reason);

    await assertion;
    expect(fn).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('rethrows immediately when shouldRetry declines the error', async () => {
    const error = new Error('Not retryable');
    const fn = vi.fn().mockRejectedValue(error);
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(retryAsyncFunction(fn, [0, 0], { shouldRetry })).rejects.toBe(error);
    expect(fn).toHaveBeenCalledOnce();
    expect(shouldRetry).toHaveBeenCalledWith(error);
  });

  test('keeps retrying while shouldRetry accepts the error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Retryable'))
      .mockResolvedValueOnce('Hello World!');
    const shouldRetry = vi.fn().mockReturnValue(true);

    await expect(retryAsyncFunction(fn, [0], { shouldRetry })).resolves.toBe('Hello World!');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('resolves with the result when the signal never aborts', async () => {
    const controller = new AbortController();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('This is an error!'))
      .mockResolvedValueOnce('Hello World!');

    await expect(retryAsyncFunction(fn, [0], { signal: controller.signal })).resolves.toBe(
      'Hello World!',
    );
  });
});

describe('waitUntil', () => {
  test('resolves with the first probe result when it is ready', async () => {
    const probe = vi.fn().mockReturnValue('ready');

    await expect(waitUntil(probe, { timeoutSeconds: 1 })).resolves.toBe('ready');
    expect(probe).toHaveBeenCalledOnce();
  });

  test('probes after every interval until a result is ready', async () => {
    vi.useFakeTimers();
    const probe = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1 });
    const assertion = expect(waitUntil(probe, { timeoutSeconds: 10 })).resolves.toStrictEqual({
      id: 1,
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(probe).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);

    await assertion;
    expect(probe).toHaveBeenCalledTimes(3);
  });

  test.each([[0], [''], [true]])('waitUntil(() => %o) -> resolves', async (value) => {
    await expect(waitUntil(() => value, { timeoutSeconds: 1 })).resolves.toBe(value);
  });

  test.each([[false], [null], [undefined]])('waitUntil(() => %o) -> times out', async (value) => {
    vi.useFakeTimers();
    const probe = vi.fn().mockReturnValue(value);
    const assertion = expectToRejectCode(
      waitUntil(probe, { timeoutSeconds: 2, intervalSeconds: 1 }),
      ERRORS.WAIT_UNTIL_TIMED_OUT,
    );

    await vi.advanceTimersByTimeAsync(2000);

    await assertion;
    expect(probe).toHaveBeenCalledTimes(3);
  });

  test('probes one final time at the deadline', async () => {
    vi.useFakeTimers();
    const probe = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('late');
    const assertion = expect(
      waitUntil(probe, { timeoutSeconds: 2.5, intervalSeconds: 1 }),
    ).resolves.toBe('late');

    await vi.advanceTimersByTimeAsync(2500);

    await assertion;
    expect(probe).toHaveBeenCalledTimes(4);
  });

  test('times out while a probe never settles', async () => {
    vi.useFakeTimers();
    const probe = vi.fn(() => new Promise<string>(() => {}));
    const assertion = expectToRejectCode(
      waitUntil(probe, { timeoutSeconds: 3 }),
      ERRORS.WAIT_UNTIL_TIMED_OUT,
    );

    await vi.advanceTimersByTimeAsync(3000);

    await assertion;
    expect(probe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('rejects with the reason when the signal aborts while a probe is pending', async () => {
    const controller = new AbortController();
    const reason = new Error('Stopped');
    const assertion = expect(
      waitUntil(() => new Promise<string>(() => {}), {
        timeoutSeconds: 10,
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);

    controller.abort(reason);

    await assertion;
  });

  test('rejects with the reason when the signal aborts between probes', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const reason = new Error('Stopped');
    const probe = vi.fn().mockReturnValue(false);
    const assertion = expect(
      waitUntil(probe, { timeoutSeconds: 10, intervalSeconds: 5, signal: controller.signal }),
    ).rejects.toBe(reason);

    await vi.advanceTimersByTimeAsync(1000);
    controller.abort(reason);

    await assertion;
    expect(probe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('rejects with the reason when the signal is already aborted', async () => {
    const reason = new Error('Stopped');
    const probe = vi.fn().mockReturnValue('ready');

    await expect(
      waitUntil(probe, { timeoutSeconds: 1, signal: AbortSignal.abort(reason) }),
    ).rejects.toBe(reason);
  });

  test('rejects with the error a probe throws', async () => {
    const error = new Error('Probe failed');

    await expect(
      waitUntil(
        () => {
          throw error;
        },
        { timeoutSeconds: 1 },
      ),
    ).rejects.toBe(error);
  });

  test('rejects with the error a probe rejects with', async () => {
    const error = new Error('Probe failed');

    await expect(waitUntil(() => Promise.reject(error), { timeoutSeconds: 1 })).rejects.toBe(error);
  });
});
