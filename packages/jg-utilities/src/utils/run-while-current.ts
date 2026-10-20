import type { IRunWhileCurrentOptions } from './types.js';

/**
 * Runs work that belongs to a state that can change while it runs, such as a request made for the
 * signed-in account, and keeps its outcome from reaching a newer state, such as another account
 * that signed in meanwhile. It subscribes to the stores whose changes matter, and once a change
 * leaves the work stale, it aborts the work's signal and stays stale, even if the state changes
 * back. Then whatever the work does, resolving or rejecting, ends in `createStaleError`. The
 * caller's signal aborts the work too, with its own reason.
 * @param run The work, which receives a signal that aborts once it's stale or the caller aborts.
 * @param options How to tell the work is current, the stores to watch, the stale error, and the
 * caller's signal.
 * @returns A promise that resolves to the work's result while it's current.
 * @example
 * import { runWhileCurrent } from 'jg-utilities';
 *
 * // the signed-in account, and the listeners told when it changes
 * let accountId = 'account-1';
 * const listeners = new Set<() => void>();
 * const subscribe = (listener: () => void) => {
 *   listeners.add(listener);
 *   return () => listeners.delete(listener);
 * };
 *
 * const requestedFor = accountId;
 * await runWhileCurrent(async () => `profile of ${requestedFor}`, {
 *   isCurrent: () => accountId === requestedFor,
 *   subscriptions: [subscribe],
 *   createStaleError: (cause) => new Error('The account changed.', { cause }),
 * }); // => 'profile of account-1'
 * @throws
 * - The caller's abort reason, when its signal aborted before the work started or before it ended.
 * - The error from `createStaleError`, when the work wasn't current at the start, or went stale.
 * - The work's own error, when it failed while current.
 */
export const runWhileCurrent = async <T>(
  run: (signal: AbortSignal) => Promise<T>,
  { isCurrent, subscriptions, createStaleError, signal }: IRunWhileCurrentOptions,
): Promise<T> => {
  const controller = new AbortController();
  let isLatched = false;
  const onCallerAbort = (): void => {
    controller.abort(signal?.reason);
  };
  const onChange = (): void => {
    if (!isLatched && !isCurrent()) {
      isLatched = true;
      controller.abort();
    }
  };
  const unsubscribes: (() => void)[] = [];
  try {
    for (const subscribe of subscriptions) {
      unsubscribes.push(subscribe(onChange));
    }
    signal?.throwIfAborted();
    signal?.addEventListener('abort', onCallerAbort, { once: true });
    if (!isCurrent()) {
      throw createStaleError(undefined);
    }
    let result: T;
    try {
      result = await run(controller.signal);
    } catch (error) {
      if (isLatched || !isCurrent()) {
        throw createStaleError(error);
      }
      throw error;
    }
    if (isLatched || !isCurrent()) {
      throw createStaleError(undefined);
    }
    signal?.throwIfAborted();
    return result;
  } finally {
    signal?.removeEventListener('abort', onCallerAbort);
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  }
};
