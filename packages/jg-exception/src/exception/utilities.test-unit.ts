import { describe, expect, test } from 'vitest';

import type * as exceptionModule from './exception.js';
import { Exception } from './exception.js';
import { isException } from './utilities.js';

// the exception module, imported a second time as a separate module instance
type IExceptionModule = typeof exceptionModule;

describe('isException', () => {
  test('recognises exceptions and rejects other values', () => {
    expect(isException(new Exception('Not found', 'NOT_FOUND'))).toBe(true);
    expect(isException(new Error('Not found'))).toBe(false);
    expect(isException(Object.assign(new Error('Not found'), { code: 'NOT_FOUND' }))).toBe(false);
    expect(isException({ name: 'Exception', message: 'Not found', code: 'NOT_FOUND' })).toBe(false);
    expect(isException(null)).toBe(false);
    expect(isException('Not found{(NOT_FOUND)}')).toBe(false);
  });

  test('recognises an exception from another copy of the package, where instanceof fails', async () => {
    // a query string makes the module loader treat the same file as a separate module
    const specifier = './exception.js?second-copy';
    const { Exception: SecondException } = (await import(
      /* @vite-ignore */ specifier
    )) as IExceptionModule;
    const exception = new SecondException('Not found', 'NOT_FOUND');

    expect(SecondException).not.toBe(Exception);
    expect(exception instanceof Exception).toBe(false);
    expect(isException(exception)).toBe(true);
  });

  test("keeps the brand out of the exception's enumerable properties", () => {
    const exception = new Exception('Not found', 'NOT_FOUND', { id: 1 });
    const brand = Symbol.for('jg-exception.Exception');

    expect(Object.getOwnPropertySymbols(exception)).toContain(brand);
    expect(Object.prototype.propertyIsEnumerable.call(exception, brand)).toBe(false);
    expect(Object.getOwnPropertySymbols({ ...exception })).toStrictEqual([]);
  });
});

describe('Exception codes', () => {
  test.each([
    [404, '404'],
    [0, '0'],
    ['NOT_FOUND', 'NOT_FOUND'],
  ] as const)('new Exception(message, %o).code -> %o', (code, expected) => {
    const exception = new Exception('Not found', code);

    expect(exception.code).toBe(expected);
    expect(exception.toRecord().code).toBe(expected);
    expect(exception.toString()).toBe(`Not found{(${expected})}`);
  });

  test('decodes numeric-looking codes from encoded messages as strings', () => {
    expect(new Exception('Not found{(404)}').code).toBe('404');
  });

  test('uses the string default code when none is given or decoded', () => {
    expect(new Exception('Not found').code).toBe('-1');
  });
});
