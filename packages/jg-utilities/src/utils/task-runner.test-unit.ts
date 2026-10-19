// @vitest-environment node
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/errors.js';

import { createTaskRunner } from './task-runner.js';

/**
 * Creates a promise the test settles.
 * @returns The promise, and its resolve and reject.
 */
const createGate = <T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('run', () => {
  test("resolves to the task's result and rejects with its error, synchronous throws included", async () => {
    const runner = createTaskRunner({ onError: vi.fn() });
    const failure = new Error('failed');

    await expect(runner.run(() => Promise.resolve('done'))).resolves.toBe('done');
    await expect(runner.run(() => Promise.reject(failure))).rejects.toBe(failure);
    await expect(
      runner.run(() => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });

  test("starts the task in the same tick, giving it the runner's signal", () => {
    const runner = createTaskRunner({ onError: vi.fn() });
    const task = vi.fn<(signal: AbortSignal) => Promise<void>>(() => Promise.resolve());

    void runner.run(task);

    expect(task).toHaveBeenCalledExactlyOnceWith(runner.signal);
  });

  test('tracks a task until it settles, by key too', async () => {
    const runner = createTaskRunner({ onError: vi.fn() });
    const gate = createGate();
    expect(runner.isIdle()).toBe(true);

    const running = runner.run(() => gate.promise, { key: 'sync' });

    expect(runner.isIdle()).toBe(false);
    expect(runner.isIdle('sync')).toBe(false);
    expect(runner.isIdle('other')).toBe(true);
    gate.resolve();
    await running;
    expect(runner.isIdle()).toBe(true);
    expect(runner.isIdle('sync')).toBe(true);
  });

  test('rejects a run with a busy key, claimed before the first task awaits anything', async () => {
    const runner = createTaskRunner({ onError: vi.fn() });
    const gate = createGate();
    const second = vi.fn(() => Promise.resolve());

    const first = runner.run(() => gate.promise, { key: 'sync' });
    await expectToRejectCode(
      runner.run(second, { key: 'sync' }),
      ERRORS.TASK_RUNNER_BUSY,
      'A task with the same key is already running.',
    );

    expect(second).not.toHaveBeenCalled();
    gate.resolve();
    await first;
    await expect(runner.run(() => Promise.resolve('again'), { key: 'sync' })).resolves.toBe(
      'again',
    );
  });

  test("joins the running task with ifBusy: 'join', running it once for three callers", async () => {
    const runner = createTaskRunner({ onError: vi.fn() });
    const gate = createGate<number>();
    const task = vi.fn(() => gate.promise);

    const results = Promise.all([
      runner.run(task, { key: 'load', ifBusy: 'join' }),
      runner.run(task, { key: 'load', ifBusy: 'join' }),
      runner.run(task, { key: 'load', ifBusy: 'join' }),
    ]);
    gate.resolve(7);

    await expect(results).resolves.toStrictEqual([7, 7, 7]);
    expect(task).toHaveBeenCalledOnce();
  });

  test("aborts only its own task when the call's signal aborts", async () => {
    const runner = createTaskRunner({ onError: vi.fn() });
    const controller = new AbortController();
    const signals: AbortSignal[] = [];
    const task = (signal: AbortSignal): Promise<void> => {
      signals.push(signal);
      return Promise.resolve();
    };

    await runner.run(task, { signal: controller.signal });
    await runner.run(task);
    controller.abort(new Error('the request ended'));

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[0]?.reason).toStrictEqual(new Error('the request ended'));
    expect(signals[1]?.aborted).toBe(false);
    expect(runner.signal.aborted).toBe(false);
  });
});

describe('trigger', () => {
  test('resolves to true once the task settles, and sends its error to onError with the key', async () => {
    const onError = vi.fn();
    const runner = createTaskRunner({ onError });
    const failure = new Error('tick failed');

    await expect(runner.trigger(() => Promise.resolve(), { key: 'tick' })).resolves.toBe(true);
    await expect(runner.trigger(() => Promise.reject(failure), { key: 'tick' })).resolves.toBe(
      true,
    );
    await expect(runner.trigger(() => Promise.reject(failure))).resolves.toBe(true);

    expect(onError.mock.calls).toStrictEqual([
      [failure, { key: 'tick' }],
      [failure, { key: undefined }],
    ]);
  });

  test('ignores what onError throws', async () => {
    const runner = createTaskRunner({
      onError: () => {
        throw new Error('the logger failed');
      },
    });

    await expect(runner.trigger(() => Promise.reject(new Error('tick failed')))).resolves.toBe(
      true,
    );
  });

  test('resolves to false at once while its key is busy, without starting the task', async () => {
    const runner = createTaskRunner({ onError: vi.fn() });
    const gate = createGate();
    const skipped = vi.fn(() => Promise.resolve());

    const first = runner.trigger(() => gate.promise, { key: 'tick' });
    await expect(runner.trigger(skipped, { key: 'tick' })).resolves.toBe(false);

    expect(skipped).not.toHaveBeenCalled();
    gate.resolve();
    await expect(first).resolves.toBe(true);
  });

  test('skips the ticks of an interval while one is still running', async () => {
    vi.useFakeTimers();
    const runner = createTaskRunner({ onError: vi.fn() });
    let started = 0;
    const task = async (): Promise<void> => {
      started += 1;
      await new Promise((resolve) => {
        setTimeout(resolve, 2_500);
      });
    };
    const interval = setInterval(() => {
      void runner.trigger(task, { key: 'sync' });
    }, 1_000);

    await vi.advanceTimersByTimeAsync(6_000);
    clearInterval(interval);
    await vi.runAllTimersAsync();

    // ticks at 1 and 4 seconds start a pass, each running 2.5 seconds; the others are skipped
    expect(started).toBe(2);
  });
});

describe('close', () => {
  test('waits for the running tasks, rejects later runs, and skips later triggers', async () => {
    const runner = createTaskRunner({ onError: vi.fn() });
    const gate = createGate();
    const running = runner.run(() => gate.promise);
    let hasClosed = false;

    const closing = runner.close().then(() => {
      hasClosed = true;
    });
    await Promise.resolve();

    expect(runner.isClosing()).toBe(true);
    expect(hasClosed).toBe(false);
    await expectToRejectCode(
      runner.run(() => Promise.resolve()),
      ERRORS.TASK_RUNNER_CLOSED,
      'The task runner is closing, so it starts no new tasks.',
    );
    await expect(runner.trigger(() => Promise.resolve())).resolves.toBe(false);
    gate.resolve();
    await running;
    await closing;
    expect(hasClosed).toBe(true);
    expect(runner.signal.aborted).toBe(false);
  });

  test('resolves even when tasks reject', async () => {
    const runner = createTaskRunner({ onError: vi.fn() });
    const running = runner.run(() => Promise.reject(new Error('failed')));

    await expect(runner.close()).resolves.toBeUndefined();
    await expect(running).rejects.toThrow('failed');
  });

  test('aborts the running tasks with abort, by default with TASK_RUNNER_CLOSED', async () => {
    const runner = createTaskRunner({ onError: vi.fn() });
    const running = runner.run(
      (signal) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(signal.reason as Error);
          });
        }),
    );

    await runner.close({ abort: true });

    await expectToRejectCode(running, ERRORS.TASK_RUNNER_CLOSED);
    expect(runner.signal.aborted).toBe(true);
  });

  test('is idempotent, and a later close with abort still aborts, with its reason', async () => {
    const runner = createTaskRunner({ onError: vi.fn() });
    const gate = createGate();
    const running = runner.run(() => gate.promise);
    const reason = new Error('shutting down');

    const first = runner.close();
    const second = runner.close();
    expect(runner.signal.aborted).toBe(false);
    const third = runner.close({ abort: true, reason });
    const fourth = runner.close({ abort: true, reason: new Error('ignored') });

    expect(runner.signal.reason).toBe(reason);
    gate.resolve();
    await Promise.all([running, first, second, third, fourth]);
  });
});
