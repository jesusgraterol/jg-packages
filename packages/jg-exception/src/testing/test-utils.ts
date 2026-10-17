import type { IErrorCode } from '../shared/types.js';
import { assertError } from './utilities.js';

/**
 * Asserts that a synchronous operation throws an error with the expected code and optional message
 * text. Codes are compared as strings, and message checks use substring matching. It works with any
 * test runner, because it throws a plain `Error` that the runner reports.
 * @param operation The synchronous operation expected to throw.
 * @param expectedCode The expected error code.
 * @param expectedMessage Optional text that the extracted error message must contain.
 * @throws
 * - Expected the operation to throw error code "{expectedCode}", but it did not throw.
 * - Expected error code "{expectedCode}", but the error did not include a code.
 * - Expected error code "{expectedCode}", but received error code "{actualCode}".
 * - Expected error message to include "{expectedMessage}", but received error message "{actualMessage}".
 * @example
 * expectToThrowCode(
 *   () => {
 *     throw Object.assign(new Error('Access denied'), { code: 'ACCESS_DENIED' });
 *   },
 *   'ACCESS_DENIED',
 *   'Access denied',
 * );
 */
export const expectToThrowCode = (
  operation: () => unknown,
  expectedCode: IErrorCode,
  expectedMessage?: string,
): void => {
  try {
    operation();
  } catch (error) {
    assertError(error, expectedCode, expectedMessage);
    return;
  }

  throw new Error(
    `Expected the operation to throw error code "${String(expectedCode)}", but it did not throw.`,
  );
};

/**
 * Asserts that a promise rejects with an error containing the expected code and optional message
 * text. Codes are compared as strings, and message checks use substring matching. It works with any
 * test runner, because it throws a plain `Error` that the runner reports.
 * @param promise The promise expected to reject.
 * @param expectedCode The expected error code.
 * @param expectedMessage Optional text that the extracted rejection message must contain.
 * @returns A promise that resolves with undefined when the rejection matches.
 * @throws
 * - Expected the promise to reject with error code "{expectedCode}", but it resolved.
 * - Expected error code "{expectedCode}", but the error did not include a code.
 * - Expected error code "{expectedCode}", but received error code "{actualCode}".
 * - Expected error message to include "{expectedMessage}", but received error message "{actualMessage}".
 * @example
 * await expectToRejectCode(
 *   Promise.reject(Object.assign(new Error('Access denied'), { code: 'ACCESS_DENIED' })),
 *   'ACCESS_DENIED',
 *   'Access denied',
 * );
 */
export const expectToRejectCode = async (
  promise: PromiseLike<unknown>,
  expectedCode: IErrorCode,
  expectedMessage?: string,
): Promise<void> => {
  try {
    await promise;
  } catch (error) {
    assertError(error, expectedCode, expectedMessage);
    return;
  }

  throw new Error(
    `Expected the promise to reject with error code "${String(expectedCode)}", but it resolved.`,
  );
};
