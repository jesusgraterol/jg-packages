import { inspect } from 'node:util';

import { extractMessage } from 'jg-exception';
import { expect } from 'vitest';

/**
 * Runs an operation that must throw, and returns what it threw.
 * @param operation The operation.
 * @returns The thrown error.
 */
export const catchError = (operation: () => unknown): unknown => {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the operation to throw, but it did not.');
};

/**
 * Awaits a promise that must reject, and returns what it rejected with.
 * @param promise The promise.
 * @returns A promise that resolves to the rejection.
 */
export const catchRejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject, but it resolved.');
};

/**
 * Asserts that an error shows a value through none of the ways it gets printed: its extracted
 * message with every cause, an inspection of every field, its stack, and its JSON.
 * @param error The error.
 * @param value The value that must not show.
 */
export const expectNoValue = (error: unknown, value: string): void => {
  expect(extractMessage(error)).not.toContain(value);
  expect(inspect(error, { depth: null })).not.toContain(value);
  expect(String((error as Error).stack)).not.toContain(value);
  expect(JSON.stringify(error)).not.toContain(value);
};
