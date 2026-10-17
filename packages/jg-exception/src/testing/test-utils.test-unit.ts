// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { expectToRejectCode, expectToThrowCode } from './test-utils.js';

describe('expectToThrowCode', () => {
  test.each(['EXPECTED_ERROR', 2_000_001] as const)(
    'accepts a thrown error with code %s',
    (expectedCode) => {
      const expectedError = Object.assign(new Error('Expected coded error.'), {
        code: expectedCode,
      });

      expect(() =>
        expectToThrowCode(() => {
          throw expectedError;
        }, expectedCode),
      ).not.toThrow();
    },
  );

  test('fails when the thrown error has a different code', () => {
    const unexpectedError = Object.assign(new Error('Unexpected coded error.'), {
      code: 'ACTUAL_ERROR',
    });
    let assertionError: unknown;

    try {
      expectToThrowCode(() => {
        throw unexpectedError;
      }, 'EXPECTED_ERROR');
    } catch (error) {
      assertionError = error;
    }

    expect(assertionError).toMatchObject({
      cause: unexpectedError,
      message: 'Expected error code "EXPECTED_ERROR", but received error code "ACTUAL_ERROR".',
    });
  });

  test('accepts a partial expected message', () => {
    const expectedError = Object.assign(new Error('Expected coded error.'), {
      code: 'EXPECTED_ERROR',
    });

    expect(() =>
      expectToThrowCode(
        () => {
          throw expectedError;
        },
        'EXPECTED_ERROR',
        'coded error',
      ),
    ).not.toThrow();
  });

  test('fails when the thrown error has a different message', () => {
    const unexpectedError = Object.assign(new Error('Actual error message.'), {
      code: 'EXPECTED_ERROR',
    });
    let assertionError: unknown;

    try {
      expectToThrowCode(
        () => {
          throw unexpectedError;
        },
        'EXPECTED_ERROR',
        'Expected error message.',
      );
    } catch (error) {
      assertionError = error;
    }

    expect(assertionError).toMatchObject({
      cause: unexpectedError,
      message:
        'Expected error message to include "Expected error message.", but received error message "Actual error message.".',
    });
  });

  test('fails when the thrown error does not include a code', () => {
    expect(() =>
      expectToThrowCode(() => {
        throw new Error('Uncoded error.');
      }, 'EXPECTED_ERROR'),
    ).toThrow('Expected error code "EXPECTED_ERROR", but the error did not include a code.');
  });

  test('fails when the operation does not throw', () => {
    expect(() => expectToThrowCode(() => undefined, 'EXPECTED_ERROR')).toThrow(
      'Expected the operation to throw error code "EXPECTED_ERROR", but it did not throw.',
    );
  });
});

describe('expectToRejectCode', () => {
  test.each(['EXPECTED_ERROR', 2_000_001] as const)(
    'accepts a rejected error with code %s',
    async (expectedCode) => {
      const expectedError = Object.assign(new Error('Expected coded error.'), {
        code: expectedCode,
      });

      await expect(expectToRejectCode(Promise.reject(expectedError), expectedCode)).resolves.toBe(
        undefined,
      );
    },
  );

  test('fails when the rejected error has a different code', async () => {
    const unexpectedError = Object.assign(new Error('Unexpected coded error.'), {
      code: 'ACTUAL_ERROR',
    });

    await expect(
      expectToRejectCode(Promise.reject(unexpectedError), 'EXPECTED_ERROR'),
    ).rejects.toMatchObject({
      cause: unexpectedError,
      message: 'Expected error code "EXPECTED_ERROR", but received error code "ACTUAL_ERROR".',
    });
  });

  test('accepts a partial expected message', async () => {
    const expectedError = Object.assign(new Error('Expected coded error.'), {
      code: 'EXPECTED_ERROR',
    });

    await expect(
      expectToRejectCode(Promise.reject(expectedError), 'EXPECTED_ERROR', 'coded error'),
    ).resolves.toBeUndefined();
  });

  test('fails when the rejected error has a different message', async () => {
    const unexpectedError = Object.assign(new Error('Actual error message.'), {
      code: 'EXPECTED_ERROR',
    });

    await expect(
      expectToRejectCode(
        Promise.reject(unexpectedError),
        'EXPECTED_ERROR',
        'Expected error message.',
      ),
    ).rejects.toMatchObject({
      cause: unexpectedError,
      message:
        'Expected error message to include "Expected error message.", but received error message "Actual error message.".',
    });
  });

  test('fails when the rejected error does not include a code', async () => {
    const unexpectedError = new Error('Uncoded error.');

    await expect(
      expectToRejectCode(Promise.reject(unexpectedError), 'EXPECTED_ERROR'),
    ).rejects.toMatchObject({
      cause: unexpectedError,
      message: 'Expected error code "EXPECTED_ERROR", but the error did not include a code.',
    });
  });

  test('fails when the promise resolves', async () => {
    await expect(expectToRejectCode(Promise.resolve(), 'EXPECTED_ERROR')).rejects.toThrow(
      'Expected the promise to reject with error code "EXPECTED_ERROR", but it resolved.',
    );
  });
});
