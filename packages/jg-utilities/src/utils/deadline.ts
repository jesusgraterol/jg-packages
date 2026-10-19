import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';

import { MAX_TIMEOUT_MS } from './constants.js';
import type { IDeadline, IDeadlineOptions, IDeadlineStopReason } from './types.js';
import { unrefTimer } from './utilities.js';

/**
 * Builds the exception for options that aren't valid.
 * @returns The INVALID_DEADLINE exception.
 */
const createInvalidDeadlineError = (): Exception =>
  new Exception(
    "The deadline needs timeoutSeconds, finite seconds of at least 0, or deadlineAt, a valid Date, epoch milliseconds, or Infinity, and a signal that's an AbortSignal when it's given.",
    { code: ERRORS.INVALID_DEADLINE },
  );

/**
 * Reads a deadline's options as epoch milliseconds: the earlier of the timeout and the time.
 * @param options The timeout, the time, or both.
 * @returns The deadline, or Infinity.
 * @throws
 * - INVALID_DEADLINE: The deadline needs timeoutSeconds, finite seconds of at least 0, or deadlineAt, a valid Date, epoch milliseconds, or Infinity, and a signal that's an AbortSignal when it's given.
 */
const readDeadlineMs = ({ timeoutSeconds, deadlineAt }: IDeadlineOptions): number => {
  const candidates: number[] = [];
  if (timeoutSeconds !== undefined) {
    if (
      typeof timeoutSeconds !== 'number' ||
      !Number.isFinite(timeoutSeconds) ||
      timeoutSeconds < 0
    ) {
      throw createInvalidDeadlineError();
    }
    candidates.push(Date.now() + timeoutSeconds * 1_000);
  }
  if (deadlineAt !== undefined) {
    const deadlineMs = deadlineAt instanceof Date ? deadlineAt.getTime() : deadlineAt;
    if (
      typeof deadlineMs !== 'number' ||
      (deadlineMs !== Number.POSITIVE_INFINITY && Number.isNaN(new Date(deadlineMs).getTime()))
    ) {
      throw createInvalidDeadlineError();
    }
    candidates.push(deadlineMs);
  }
  if (candidates.length === 0) {
    throw createInvalidDeadlineError();
  }
  return Math.min(...candidates);
};

/**
 * Creates a deadline for a bounded job, such as a request handler's or a cron pass's, from a
 * timeout, a time, or both, the earlier winning, and a caller's signal. Its signal aborts with a
 * TimeoutError DOMException when the deadline passes, which jg-fetch reads as a timeout, or with
 * the caller's reason, and its timer waits in steps of at most 2^31 - 1 milliseconds, so a
 * deadline days away works. `throwIfStopped` reads the clock, so it notices a deadline that
 * passed while the process was suspended, before the timer fires. Call `dispose` once the work
 * ends early, to stop the timer.
 * @param options The timeout in seconds, the time, and the caller's signal.
 * @returns The deadline.
 * @example
 * import { createDeadline } from 'jg-utilities';
 *
 * const files = ['a.txt', 'b.txt'];
 * const uploaded: string[] = [];
 * const deadline = createDeadline({ timeoutSeconds: 55 });
 * try {
 *   for (const file of files) {
 *     deadline.throwIfStopped(); // throws DEADLINE_EXCEEDED once 55 seconds passed
 *     uploaded.push(file); // such as an upload given deadline.signal
 *   }
 * } finally {
 *   deadline.dispose();
 * }
 * uploaded; // => ['a.txt', 'b.txt']
 * deadline.stopReason(); // => null
 * @throws
 * - INVALID_DEADLINE: The deadline needs timeoutSeconds, finite seconds of at least 0, or deadlineAt, a valid Date, epoch milliseconds, or Infinity, and a signal that's an AbortSignal when it's given.
 */
export const createDeadline = (options: IDeadlineOptions): IDeadline => {
  const { signal: callerSignal } = options;
  if (callerSignal !== undefined && !(callerSignal instanceof AbortSignal)) {
    throw createInvalidDeadlineError();
  }
  const deadlineAt = readDeadlineMs(options);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  // aborts at the deadline, re-arming while it's further away than setTimeout can wait
  const schedule = (): void => {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) {
      timer = undefined;
      controller.abort(new DOMException('The deadline passed.', 'TimeoutError'));
      return;
    }
    timer = setTimeout(schedule, Math.min(remaining, MAX_TIMEOUT_MS));
    unrefTimer(timer);
  };
  if (deadlineAt !== Number.POSITIVE_INFINITY) {
    schedule();
  }

  const isExpired = (): boolean => Date.now() >= deadlineAt;

  const stopReason = (): IDeadlineStopReason | null => {
    if (callerSignal?.aborted === true) {
      return 'cancelled';
    }
    return isExpired() ? 'deadline' : null;
  };

  return {
    deadlineAt,
    signal:
      callerSignal === undefined
        ? controller.signal
        : AbortSignal.any([callerSignal, controller.signal]),
    remainingMs: () => Math.max(0, deadlineAt - Date.now()),
    isExpired,
    stopReason,
    throwIfStopped: () => {
      callerSignal?.throwIfAborted();
      if (isExpired()) {
        throw new Exception('The deadline passed before the work finished.', {
          code: ERRORS.DEADLINE_EXCEEDED,
          data: { deadlineAt: new Date(deadlineAt).toISOString() },
        });
      }
    },
    child: ({ timeoutSeconds }) => {
      // the child's own time, capped at this deadline
      const childDeadlineAt = Math.min(readDeadlineMs({ timeoutSeconds }), deadlineAt);
      return createDeadline({ deadlineAt: childDeadlineAt, signal: callerSignal });
    },
    dispose: () => {
      clearTimeout(timer);
      timer = undefined;
    },
  };
};
