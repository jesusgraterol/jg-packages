import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';

import type { IDelayOptions, IRetryAsyncFunctionOptions, IWaitUntilOptions } from './types.js';

/**
 * Settles with the provided promise unless the signal aborts or the time limit passes first. The
 * promise keeps running when it loses the race, because a promise can't be cancelled.
 * @param promise The promise to settle with.
 * @param signal? The signal that rejects the race with its reason when it aborts.
 * @param timeLimit? The milliseconds after which the race rejects with the provided error.
 * @returns A promise that settles with the first outcome.
 */
const race = <T>(
  promise: Promise<T>,
  signal?: AbortSignal,
  timeLimit?: { milliseconds: number; error: () => Error },
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rejects with the signal's reason, as native APIs do
      reject(signal.reason);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = (): void => {
      clearTimeout(timer);
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rejects with the signal's reason, as native APIs do
      reject(signal?.reason);
    };
    const cleanUp = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    if (timeLimit !== undefined) {
      timer = setTimeout(
        () => {
          signal?.removeEventListener('abort', onAbort);
          reject(timeLimit.error());
        },
        Math.max(0, timeLimit.milliseconds),
      );
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        cleanUp();
        resolve(value);
      },
      (error: unknown) => {
        cleanUp();
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- forwards the original rejection unchanged
        reject(error);
      },
    );
  });

/**
 * Settles with a promise unless the signal aborts first, such as to stop waiting for a step that
 * can't be cancelled when the user leaves the page. It rejects with the signal's reason, at once
 * when the signal was already aborted, and removes its listener either way. The promise itself
 * keeps running, because a promise can't be cancelled.
 * @param promise The promise.
 * @param options The signal that stops the wait.
 * @returns A promise that settles as the promise does, unless the signal aborts first.
 * @example
 * import { abortable, delay } from 'jg-utilities';
 *
 * await abortable(Promise.resolve('done'), { signal: new AbortController().signal }); // => 'done'
 * await abortable(delay(10), { signal: AbortSignal.abort('left') }).catch((reason) => reason); // => 'left'
 * @throws
 * - The signal's reason, when it aborts before the promise settles.
 * - The promise's own error.
 */
export const abortable = <T>(
  promise: Promise<T>,
  { signal }: { signal: AbortSignal },
): Promise<T> => race(promise, signal);

/**
 * Creates an asynchronous delay that resolves once the provided seconds have passed.
 * @param seconds The number of seconds to delay before the promise resolves.
 * @param options? The signal that cancels the delay.
 * @returns A promise that resolves after the specified number of seconds has passed.
 * @example
 * import { delay } from 'jg-utilities';
 *
 * await delay(0.5); // resumes after half a second
 * await delay(10, { signal: AbortSignal.timeout(100) }).catch(() => 'stopped'); // => 'stopped'
 * @throws
 * - The signal's reason when the signal is already aborted or aborts during the wait.
 */
export const delay = (seconds: number, options?: IDelayOptions): Promise<void> =>
  new Promise((resolve, reject) => {
    const signal = options?.signal;
    if (signal?.aborted) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rejects with the signal's reason, as native APIs do
      reject(signal.reason);
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rejects with the signal's reason, as native APIs do
      reject(signal?.reason);
    };
    const timer = setTimeout(
      () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      },
      Math.round(seconds * 1000),
    );
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Executes an asynchronous function persistently, retrying on error with incremental delays
 * defined in retryScheduleDuration (seconds). When the signal aborts, the returned promise rejects
 * immediately, even while an attempt is pending. The attempt's own work isn't cancelled; pass the
 * signal into it as well when it supports one.
 * @param fn The asynchronous function to be executed persistently.
 * @param retryScheduleDuration? An array of numbers representing the delay (in seconds) between each retry attempt. Defaults to [3, 5].
 * @param options? The signal that stops the retries and a predicate that decides whether an error is retried.
 * @returns A promise that resolves with the result of the asynchronous function or rejects with the last encountered error.
 * @example
 * import { retryAsyncFunction } from 'jg-utilities';
 *
 * let attempts = 0;
 * const readRate = async (): Promise<number> => {
 *   attempts += 1;
 *   if (attempts < 2) {
 *     throw new Error('The service is busy.');
 *   }
 *   return 1.08;
 * };
 *
 * // up to 3 attempts, 0.1 and 0.5 seconds apart
 * await retryAsyncFunction(readRate, [0.1, 0.5]); // => 1.08
 * attempts; // => 2
 * @throws
 * - The last error thrown by the function, or the first one shouldRetry declines to retry.
 * - The signal's reason when the signal aborts.
 */
export const retryAsyncFunction = async <T>(
  fn: () => Promise<T>,
  retryScheduleDuration: number[] = [3, 5],
  options?: IRetryAsyncFunctionOptions,
): Promise<T> => {
  const signal = options?.signal;
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted();
    try {
      // attempts run one after another by design
      return await race(fn(), signal);
    } catch (error) {
      signal?.throwIfAborted();
      if (attempt >= retryScheduleDuration.length || options?.shouldRetry?.(error) === false) {
        throw error;
      }
    }
    await delay(retryScheduleDuration[attempt] ?? 0, { signal });
  }
};

/**
 * Checks whether a probe result means the awaited condition was met.
 * @param value The value the probe returned.
 * @returns True unless the value is null, undefined or false.
 */
const isReady = <T>(value: T): value is Exclude<T, null | undefined | false> =>
  value !== null && value !== undefined && value !== false;

/**
 * Invokes a probe so that a synchronous throw becomes a rejection.
 * @param probe The probe to invoke.
 * @returns A promise that settles with the probe's result.
 */
const runProbe = async <T>(probe: () => T | Promise<T>): Promise<T> => probe();

/**
 * Probes a condition until it returns a value other than null, undefined or false, and resolves
 * with that value. It probes immediately, then after every interval, and one final time at the
 * deadline. The timeout bounds the whole call, so it rejects even while a probe is still pending.
 * A running probe isn't cancelled when the call stops waiting; pass your own signal into it when
 * it supports one.
 * @param probe The function that checks the condition.
 * @param options The timeout, the interval between probes and the signal that stops the wait.
 * @returns A promise that resolves with the first ready value.
 * @example
 * import { waitUntil } from 'jg-utilities';
 *
 * const startedAt = Date.now();
 * const readStatus = (): string => (Date.now() - startedAt > 200 ? 'ready' : 'starting');
 *
 * // the probe runs every 0.1 seconds until it returns something other than undefined
 * await waitUntil(() => (readStatus() === 'ready' ? readStatus() : undefined), {
 *   timeoutSeconds: 5,
 *   intervalSeconds: 0.1,
 * }); // => 'ready'
 * @throws
 * - WAIT_UNTIL_TIMED_OUT: if the condition isn't met before the timeout.
 * - The probe's error when a probe throws or rejects.
 * - The signal's reason when the signal aborts.
 */
export const waitUntil = async <T>(
  probe: () => T | Promise<T>,
  options: IWaitUntilOptions,
): Promise<Exclude<T, null | undefined | false>> => {
  const { timeoutSeconds, intervalSeconds = 1, signal } = options;
  const deadline = Date.now() + timeoutSeconds * 1000;
  const timedOut = (): Error =>
    new Exception(`The condition wasn't met within ${timeoutSeconds} seconds.`, {
      code: ERRORS.WAIT_UNTIL_TIMED_OUT,
    });
  for (;;) {
    // probes run one after another by design
    const result = await race(runProbe(probe), signal, {
      milliseconds: deadline - Date.now(),
      error: timedOut,
    });
    if (isReady(result)) {
      return result;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw timedOut();
    }
    await delay(Math.min(intervalSeconds * 1000, remaining) / 1000, { signal });
  }
};
