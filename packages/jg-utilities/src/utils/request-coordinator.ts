import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import { isIntegerValid } from '../validations/index.js';

import { MAX_TIMEOUT_MS } from './constants.js';
import type {
  IRequestCoordinator,
  IRequestCoordinatorOptions,
  IRunRequestOptions,
} from './types.js';

// a task waiting for a slot
type IWaiter = {
  caller: unknown;
  signal: AbortSignal | undefined;
  rejectDuringCooldown: boolean;
  resolve: () => void;
  reject: (reason: unknown) => void;
  // removes the waiter's abort listener
  detach: () => void;
};

/**
 * Checks a queue limit, which is an integer of at least 0.
 * @param limit The limit.
 * @param name The option's name, for the error's data.
 * @throws
 * - INVALID_QUEUE_LIMIT: The queue limit must be an integer of at least 0.
 */
const assertQueueLimit = (limit: unknown, name: string): void => {
  if (!isIntegerValid(limit, 0)) {
    throw new Exception('The queue limit must be an integer of at least 0.', {
      code: ERRORS.INVALID_QUEUE_LIMIT,
      data: { [name]: String(limit) },
    });
  }
};

/**
 * Converts a deadline to epoch milliseconds.
 * @param deadline A Date, or epoch milliseconds.
 * @returns The epoch milliseconds.
 * @throws
 * - INVALID_DATE: The deadline must be a valid Date or epoch milliseconds a Date accepts.
 */
const toDeadlineMs = (deadline: Date | number): number => {
  const deadlineMs = deadline instanceof Date ? deadline.getTime() : deadline;
  if (typeof deadlineMs !== 'number' || Number.isNaN(new Date(deadlineMs).getTime())) {
    throw new Exception('The deadline must be a valid Date or epoch milliseconds a Date accepts.', {
      code: ERRORS.INVALID_DATE,
      data: { deadline: String(deadline) },
    });
  }
  return deadlineMs;
};

/**
 * Creates a coordinator that runs tasks, such as requests to a rate-limited API, at most
 * `maxConcurrent` at a time, and queues the rest, first in, first out, up to `maxQueued`. A caller
 * can be capped too, with `caller` and `maxQueuedForCaller`, so one caller can't fill the queue.
 *
 * `deferUntil` starts a cooldown, such as from a `Retry-After` header: queued tasks wait until it
 * ends, without holding a slot, and tasks run with `rejectDuringCooldown` reject at once instead.
 * A task whose signal aborts while it waits leaves the queue. A task's own result or error passes
 * through unchanged, and its slot is released either way. No timer is left once nothing waits.
 *
 * `run` rejects with `REQUEST_QUEUE_FULL` when the queue, or the caller's share of it, is full,
 * with `REQUEST_COOLDOWN_ACTIVE` when the task may not wait out a cooldown, with
 * `REQUEST_COORDINATOR_CLOSED` after `close`, and with `INVALID_QUEUE_LIMIT` for a
 * `maxQueuedForCaller` that isn't an integer of at least 0. `deferUntil` throws `INVALID_DATE`
 * for a deadline that isn't a valid date.
 * @param options The concurrency and queue limits.
 * @returns The coordinator.
 * @example
 * import { createRequestCoordinator } from 'jg-utilities';
 *
 * const github = createRequestCoordinator({ maxConcurrent: 4, maxQueued: 64 });
 * const fetchIssues = (): Promise<Response> =>
 *   github.run(() => fetch('https://api.github.com/repos/octocat/hello-world/issues'));
 * @throws
 * - INVALID_CONCURRENCY_LIMIT: The concurrency limit must be an integer of at least 1.
 * - INVALID_QUEUE_LIMIT: The queue limit must be an integer of at least 0.
 */
export const createRequestCoordinator = ({
  maxConcurrent,
  maxQueued,
}: IRequestCoordinatorOptions): IRequestCoordinator => {
  if (!isIntegerValid(maxConcurrent, 1)) {
    throw new Exception('The concurrency limit must be an integer of at least 1.', {
      code: ERRORS.INVALID_CONCURRENCY_LIMIT,
      data: { maxConcurrent: String(maxConcurrent) },
    });
  }
  assertQueueLimit(maxQueued, 'maxQueued');
  let activeCount = 0;
  let cooldownUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let isClosed = false;
  const waiters: IWaiter[] = [];

  const createCooldownError = (): Exception =>
    new Exception('Requests are paused until the cooldown ends.', {
      code: ERRORS.REQUEST_COOLDOWN_ACTIVE,
      data: { retryAt: new Date(cooldownUntil).toISOString() },
    });

  const createClosedError = (): Exception =>
    new Exception('The request coordinator is closed.', {
      code: ERRORS.REQUEST_COORDINATOR_CLOSED,
    });

  const clearTimer = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  // starts the waiting tasks the free slots allow, or waits out an active cooldown
  const schedule = (): void => {
    clearTimer();
    if (waiters.length === 0) {
      return;
    }
    const remainingMs = cooldownUntil - Date.now();
    if (remainingMs > 0) {
      for (let index = waiters.length - 1; index >= 0; index -= 1) {
        const waiter = waiters[index];
        if (waiter?.rejectDuringCooldown === true) {
          waiters.splice(index, 1);
          waiter.detach();
          waiter.reject(createCooldownError());
        }
      }
      if (waiters.length > 0) {
        timer = setTimeout(schedule, Math.min(remainingMs, MAX_TIMEOUT_MS));
      }
      return;
    }
    while (activeCount < maxConcurrent) {
      const waiter = waiters.shift();
      if (waiter === undefined) {
        return;
      }
      waiter.detach();
      if (waiter.signal?.aborted === true) {
        waiter.reject(waiter.signal.reason);
      } else {
        activeCount += 1;
        waiter.resolve();
      }
    }
  };

  // waits for a slot, or rejects when the task can't run or wait
  const acquire = ({
    signal,
    caller,
    maxQueuedForCaller,
    rejectDuringCooldown = false,
  }: IRunRequestOptions): Promise<void> => {
    if (isClosed) {
      return Promise.reject(createClosedError());
    }
    if (signal?.aborted === true) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rejects with the signal's reason, as native APIs do
      return Promise.reject(signal.reason);
    }
    if (maxQueuedForCaller !== undefined) {
      assertQueueLimit(maxQueuedForCaller, 'maxQueuedForCaller');
    }
    const isCoolingDown = cooldownUntil > Date.now();
    if (isCoolingDown && rejectDuringCooldown) {
      return Promise.reject(createCooldownError());
    }
    if (!isCoolingDown && activeCount < maxConcurrent && waiters.length === 0) {
      activeCount += 1;
      return Promise.resolve();
    }
    if (maxQueuedForCaller !== undefined) {
      const callerQueued = waiters.filter((waiter) => waiter.caller === caller).length;
      if (callerQueued >= maxQueuedForCaller) {
        return Promise.reject(
          new Exception('The request queue is full.', {
            code: ERRORS.REQUEST_QUEUE_FULL,
            data: { scope: 'caller', queued: callerQueued, limit: maxQueuedForCaller },
          }),
        );
      }
    }
    if (waiters.length >= maxQueued) {
      return Promise.reject(
        new Exception('The request queue is full.', {
          code: ERRORS.REQUEST_QUEUE_FULL,
          data: { scope: 'global', queued: waiters.length, limit: maxQueued },
        }),
      );
    }
    return new Promise<void>((resolve, reject) => {
      const onAbort = (): void => {
        // the waiter is still queued: every path that dequeues one also removes this listener
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.detach();
        schedule();
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rejects with the signal's reason, as native APIs do
        reject(signal?.reason);
      };
      const waiter: IWaiter = {
        caller,
        signal,
        rejectDuringCooldown,
        resolve,
        reject,
        detach: () => signal?.removeEventListener('abort', onAbort),
      };
      waiters.push(waiter);
      signal?.addEventListener('abort', onAbort, { once: true });
      schedule();
    });
  };

  return {
    run: async (task, options = {}) => {
      await acquire(options);
      try {
        return await task();
      } finally {
        activeCount -= 1;
        schedule();
      }
    },
    deferUntil: (deadline) => {
      cooldownUntil = Math.max(cooldownUntil, toDeadlineMs(deadline));
      schedule();
    },
    isIdle: () => activeCount === 0 && waiters.length === 0 && cooldownUntil <= Date.now(),
    close: () => {
      isClosed = true;
      clearTimer();
      for (const waiter of waiters.splice(0)) {
        waiter.detach();
        waiter.reject(createClosedError());
      }
    },
  };
};
