import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';

import type {
  ICloseTaskRunnerOptions,
  IRunTaskOptions,
  ITaskRunner,
  ITaskRunnerOptions,
} from './types.js';

/**
 * Builds the exception for a task started once the runner is closing.
 * @returns The TASK_RUNNER_CLOSED exception.
 */
const createClosedError = (): Exception =>
  new Exception('The task runner is closing, so it starts no new tasks.', {
    code: ERRORS.TASK_RUNNER_CLOSED,
  });

/**
 * Creates a runner for background tasks, such as a service's timer ticks or queue passes, that a
 * shutdown can drain: `close` stops new tasks at once, optionally aborts the running ones through
 * the signal each task receives, and resolves once every task has settled.
 *
 * `run` starts a task now and passes its result or error through, after claiming its `key`, so
 * only one task with that key runs at a time: another `run` with the key rejects with
 * TASK_RUNNER_BUSY, or, with `ifBusy: 'join'`, resolves to the running task's result. `trigger`
 * is for timers: it skips a tick while the key's task runs or the runner is closing, resolving to
 * false, and sends a task's error to `onError` instead of rejecting.
 * @param options Where trigger's errors go.
 * @returns The runner.
 * @example
 * import { createTaskRunner } from 'jg-utilities';
 *
 * const runner = createTaskRunner({ onError: (error) => console.error(error) });
 * const syncInvoices = (signal: AbortSignal): Promise<number> =>
 *   Promise.resolve(signal.aborted ? 0 : 3);
 *
 * await runner.run(syncInvoices, { key: 'invoices' }); // => 3
 * await runner.trigger(syncInvoices, { key: 'invoices' }); // => true
 *
 * // at shutdown: no new tasks, and resolved once the running ones settle
 * await runner.close({ abort: true });
 * runner.isClosing(); // => true
 */
export const createTaskRunner = ({ onError }: ITaskRunnerOptions): ITaskRunner => {
  const controller = new AbortController();
  // each running task's settlement, which never rejects, so close can wait for all of them
  const settlements = new Set<Promise<void>>();
  // the running task of each key
  const tasksByKey = new Map<string, Promise<unknown>>();
  let isClosing = false;

  /**
   * Starts a task and tracks it until it settles.
   * @param task The task.
   * @param key Its key, already free.
   * @param signal The call's signal, combined with the runner's.
   * @returns The task's promise.
   */
  const start = <T>(
    task: (signal: AbortSignal) => Promise<T>,
    key: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<T> => {
    const taskSignal =
      signal === undefined ? controller.signal : AbortSignal.any([controller.signal, signal]);
    // the executor runs now, so the task starts in this tick, and a synchronous throw rejects
    const promise = new Promise<T>((resolve) => {
      resolve(task(taskSignal));
    });
    if (key !== undefined) {
      tasksByKey.set(key, promise);
    }
    // registered before any caller's await, so the runner is idle again by the time a caller resumes
    const finish = (): void => {
      settlements.delete(settlement);
      // no other task can hold the key while this one runs
      if (key !== undefined) {
        tasksByKey.delete(key);
      }
    };
    const settlement: Promise<void> = promise.then(finish, finish);
    settlements.add(settlement);
    return promise;
  };

  /**
   * Starts a task now, unless the runner is closing or a task with its key runs.
   * @param task The task, given a signal the runner's close and the call's signal abort.
   * @param options Its key, what to do while the key is busy, and its signal.
   * @returns A promise that resolves or rejects as the task does.
   * @throws
   * - TASK_RUNNER_CLOSED: The task runner is closing, so it starts no new tasks.
   * - TASK_RUNNER_BUSY: A task with the same key is already running.
   */
  const run = <T>(
    task: (signal: AbortSignal) => Promise<T>,
    { key, ifBusy = 'reject', signal }: IRunTaskOptions = {},
  ): Promise<T> => {
    if (isClosing) {
      return Promise.reject(createClosedError());
    }
    const running = key === undefined ? undefined : tasksByKey.get(key);
    if (key === undefined || running === undefined) {
      return start(task, key, signal);
    }
    return ifBusy === 'join'
      ? (running as Promise<T>)
      : Promise.reject(
          new Exception('A task with the same key is already running.', {
            code: ERRORS.TASK_RUNNER_BUSY,
            data: { key },
          }),
        );
  };

  /**
   * Starts a task unless the runner is closing or a task with its key runs, sending its error to
   * onError.
   * @param task The task.
   * @param options Its key.
   * @returns A promise that resolves to false at once when the task didn't start, or to true once
   * it settled.
   */
  const trigger = async (
    task: (signal: AbortSignal) => Promise<unknown>,
    { key }: { key?: string | undefined } = {},
  ): Promise<boolean> => {
    if (isClosing || (key !== undefined && tasksByKey.has(key))) {
      return false;
    }
    try {
      await start(task, key, undefined);
    } catch (error) {
      try {
        onError(error, { key });
      } catch {
        // onError's own failure is ignored, so a tick never rejects
      }
    }
    return true;
  };

  /**
   * Stops new tasks, optionally aborts the running ones, and waits for them to settle.
   * @param options Whether to abort, and why.
   * @returns A promise that resolves once every task settled.
   */
  const close = async ({ abort = false, reason }: ICloseTaskRunnerOptions = {}): Promise<void> => {
    isClosing = true;
    if (abort && !controller.signal.aborted) {
      controller.abort(reason ?? createClosedError());
    }
    // no task starts once the runner is closing, so these are the last ones
    await Promise.all(settlements);
  };

  return {
    run,
    trigger,
    signal: controller.signal,
    isClosing: () => isClosing,
    isIdle: (key) => (key === undefined ? settlements.size === 0 : !tasksByKey.has(key)),
    close,
  };
};
