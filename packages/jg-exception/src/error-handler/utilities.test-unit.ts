import { describe, expect, test } from 'vitest';
import { z, ZodError, type ZodType } from 'zod';

import { DEFAULT_CODE, DEFAULT_MESSAGE } from '../shared/constants.js';
import { Exception } from '../exception/index.js';
import {
  extractZodErrorMessage,
  getDecodedErrorCode,
  isZodErrorLike,
  redactSensitiveValues,
} from './utilities.js';

/* ************************************************************************************************
 *                                             HELPERS                                            *
 ************************************************************************************************ */

/**
 * Parses invalid input and returns the ZodError emitted by the provided schema.
 * @param schema The schema expected to reject the input.
 * @param input The invalid value to parse.
 * @returns The ZodError emitted by the schema.
 */
const getZodError = (schema: ZodType, input: unknown): ZodError => {
  const result = schema.safeParse(input);

  if (!result.success) {
    return result.error;
  }

  throw new Error('Expected schema parsing to fail.');
};

/* ************************************************************************************************
 *                                             TESTS                                              *
 ************************************************************************************************ */

describe('redactSensitiveValues', () => {
  test('redacts every literal occurrence of a sensitive value', () => {
    const sensitiveValue = '.*+?^${}()|[]\\';

    expect(
      redactSensitiveValues(`Before ${sensitiveValue}, between ${sensitiveValue}, and after.`, [
        sensitiveValue,
      ]),
    ).toBe('Before [redacted], between [redacted], and after.');
  });

  test('deduplicates values and merges contained occurrences', () => {
    const sensitiveValues = ['secret', 'secret-token', 'secret-token'];

    expect(redactSensitiveValues('secret-token and secret-token', sensitiveValues)).toBe(
      '[redacted] and [redacted]',
    );
    expect(sensitiveValues).toStrictEqual(['secret', 'secret-token', 'secret-token']);
  });

  test.each([
    ['shifted values in forward order', 'abcd', ['abc', 'bcd']],
    ['shifted values in reverse order', 'abcd', ['bcd', 'abc']],
    ['shifted values with different lengths', 'abcde', ['abcd', 'bcde']],
    ['overlapping occurrences of the same value', 'aaa', ['aa']],
  ])('redactSensitiveValues(%s) -> one marker', (_, message, sensitiveValues) => {
    expect(redactSensitiveValues(message, sensitiveValues)).toBe('[redacted]');
  });

  test('keeps markers separate for adjacent non-overlapping values', () => {
    expect(redactSensitiveValues('abcdef', ['abc', 'def'])).toBe('[redacted][redacted]');
  });

  test.each([
    ['an empty list', []],
    ['an empty-string-only list', ['', '']],
    ['a non-matching list', ['different-value']],
  ])('returns the unchanged message for %s', (_, sensitiveValues) => {
    expect(redactSensitiveValues('Request failed.', sensitiveValues)).toBe('Request failed.');
  });

  test('matches sensitive values case-sensitively', () => {
    expect(redactSensitiveValues('Token token TOKEN', ['token'])).toBe('Token [redacted] TOKEN');
  });

  test('does not process an inserted redaction marker again', () => {
    expect(redactSensitiveValues('secret', ['secret', 'redacted'])).toBe('[redacted]');
  });
});

describe('extractZodErrorMessage', () => {
  test('can extract the first issue message and path from a ZodError', () => {
    const error = getZodError(z.object({ name: z.string() }), { name: 123 });

    expect(extractZodErrorMessage(error)).toBe(
      'Invalid input: expected string, received number (name)',
    );
  });

  test('can extract a nested object and array path from a ZodError', () => {
    const error = getZodError(
      z.object({
        someDict: z.object({ innerList: z.array(z.object({ someProp: z.string() })) }),
      }),
      { someDict: { innerList: [{ someProp: 123 }] } },
    );

    expect(extractZodErrorMessage(error)).toBe(
      'Invalid input: expected string, received number (someDict.innerList.0.someProp)',
    );
  });

  test('uses Unknown path when the first issue has no path segments', () => {
    const error = getZodError(z.string(), 123);

    expect(extractZodErrorMessage(error)).toBe(
      'Invalid input: expected string, received number (Unknown path)',
    );
  });

  test('returns the default message when the ZodError has no usable issue message', () => {
    expect(extractZodErrorMessage(new ZodError([]))).toBe(DEFAULT_MESSAGE);
    expect(
      extractZodErrorMessage(new ZodError([{ code: 'custom', message: '', path: ['name'] }])),
    ).toBe(DEFAULT_MESSAGE);
  });
});

describe('getDecodedErrorCode', () => {
  test('returns the object code when the unwrapped code is the default code', () => {
    expect(getDecodedErrorCode({ code: 'INVALID_INPUT' }, DEFAULT_CODE)).toBe('INVALID_INPUT');
    expect(getDecodedErrorCode({ code: '0' }, DEFAULT_CODE)).toBe('0');
    expect(getDecodedErrorCode({ code: 0 }, DEFAULT_CODE)).toBe('0');
    expect(getDecodedErrorCode({ code: 100 }, DEFAULT_CODE)).toBe('100');
    expect(getDecodedErrorCode(new Exception('There was an error.', 'INVALID_INPUT'), '-1')).toBe(
      'INVALID_INPUT',
    );
  });

  test('returns the default code when the unwrapped code is default and the error is not a carrier', () => {
    expect(getDecodedErrorCode(null, DEFAULT_CODE)).toBe(DEFAULT_CODE);
    expect(getDecodedErrorCode(undefined, DEFAULT_CODE)).toBe(DEFAULT_CODE);
    expect(getDecodedErrorCode('INVALID_INPUT', DEFAULT_CODE)).toBe(DEFAULT_CODE);
    expect(getDecodedErrorCode({ message: 'There was an error.' }, DEFAULT_CODE)).toBe(
      DEFAULT_CODE,
    );
    expect(getDecodedErrorCode({ code: null }, DEFAULT_CODE)).toBe(DEFAULT_CODE);
    expect(getDecodedErrorCode({ code: true }, DEFAULT_CODE)).toBe(DEFAULT_CODE);
    expect(getDecodedErrorCode({ code: ['INVALID_INPUT'] }, DEFAULT_CODE)).toBe(DEFAULT_CODE);
  });

  test('returns the unwrapped code when it is not the default code', () => {
    expect(getDecodedErrorCode({ code: 'OUTER_CODE' }, 'INNER_CODE')).toBe('INNER_CODE');
    expect(getDecodedErrorCode({ code: 100 }, '200')).toBe('200');
    expect(getDecodedErrorCode('There was an error.', 'INNER_CODE')).toBe('INNER_CODE');
    expect(getDecodedErrorCode({ code: null }, 'INNER_CODE')).toBe('INNER_CODE');
  });
});

describe('isZodErrorLike', () => {
  test('recognises an object named ZodError with an issues array, from any copy of zod', () => {
    expect(isZodErrorLike({ name: 'ZodError', issues: [] })).toBe(true);
    expect(isZodErrorLike(Object.assign(new Error('x'), { name: 'ZodError', issues: [] }))).toBe(
      true,
    );
  });

  test.each([
    [{ name: 'ZodError', issues: 'not an array' }],
    [{ name: 'Error', issues: [] }],
    [{ issues: [] }],
    [null],
    ['ZodError'],
  ])('isZodErrorLike(%o) -> false', (value) => {
    expect(isZodErrorLike(value)).toBe(false);
  });

  test('formats the first issue of a ZodError-shaped object, including symbol path keys', () => {
    expect(
      extractZodErrorMessage({
        name: 'ZodError',
        issues: [{ message: 'Required', path: ['items', 0, Symbol('meta')] }],
      }),
    ).toBe('Required (items.0.Symbol(meta))');
  });
});
