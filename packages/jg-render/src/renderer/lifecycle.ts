import { abortable } from 'jg-utilities';

import { renderError } from './errors.js';

/**
 * Runs an operation under the applicable signal. Never exposes the caller's arbitrary abort reason.
 * @param signal The session signal or a combined deadline signal.
 * @param cancellation The session signal, if one was supplied.
 * @param run The asynchronous operation.
 * @returns The result of the operation before the signal fires.
 */
export const beforeAbort = async <T>(
  signal: AbortSignal | undefined,
  cancellation: AbortSignal | undefined,
  run: () => Promise<T>,
): Promise<T> => {
  if (signal === undefined) return run();
  const abortError = (): Error => renderError(cancellation?.aborted ? 'cancelled' : 'timeout');
  if (signal.aborted) throw abortError();
  const operation = Promise.resolve().then(() => {
    if (signal.aborted) throw abortError();
    return run();
  });
  try {
    return await abortable(operation, { signal });
  } catch (error) {
    if (signal.aborted) throw abortError();
    throw error;
  }
};

/**
 * Waits for the owned browser resource to close before returning.
 * @param run The operation using the resource.
 * @param close The owned resource's cleanup.
 * @returns The operation result after cleanup.
 */
export const withCleanup = async <T>(
  run: () => Promise<T>,
  close: () => Promise<void>,
): Promise<T> => {
  try {
    return await run();
  } finally {
    await close().catch(() => {
      throw renderError('cleanup');
    });
  }
};
