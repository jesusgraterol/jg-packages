import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import { ERRORS } from './errors.js';
import { buildDataKey, parseJSON, parseValue, stringifyJSON } from './utilities.js';

describe('buildDataKey', () => {
  test.each([
    [
      'testStoreID',
      '16ceb975-4989-4c86-8b63-99294e86a13d',
      'testStoreID_16ceb975-4989-4c86-8b63-99294e86a13d',
    ],
    ['testStoreID', 655643215461, 'testStoreID_655643215461'],
    ['testStoreID', undefined, 'testStoreID'],
  ])('buildDataKey(%s, %s) -> %s', (storeId, recordId, expected) => {
    expect(buildDataKey(storeId, recordId)).toBe(expected);
  });
});

describe('parseValue', () => {
  test('returns the value as it is without a schema', () => {
    const value = { foo: 'bar' };
    expect(parseValue(value, {})).toBe(value);
  });

  test('runs the schema and returns its result', () => {
    const parse = vi.fn((value: unknown) => String(value).toUpperCase());
    expect(parseValue('hello', { schema: { parse } })).toBe('HELLO');
    expect(parse).toHaveBeenCalledWith('hello');
  });
});

describe('parseJSON', () => {
  test.each([
    ['{"foo":"bar"}', { foo: 'bar' }],
    ['[1,2,3]', [1, 2, 3]],
    ['"text"', 'text'],
    ['12.5', 12.5],
    ['true', true],
    ['null', null],
  ])('parseJSON(%s) -> %j', (data, expected) => {
    expect(parseJSON(data)).toStrictEqual(expected);
  });

  test.each(['{foo}', 'undefined', 'text', ''])('rejects %j', (data) => {
    expectToThrowCode(() => parseJSON(data), ERRORS.FAILED_TO_PARSE_JSON);
  });
});

describe('stringifyJSON', () => {
  test.each([
    [{ foo: 'bar' }, '{"foo":"bar"}'],
    [[1, 2, 3], '[1,2,3]'],
    ['text', '"text"'],
    [12.5, '12.5'],
    [false, 'false'],
    [null, 'null'],
  ])('stringifyJSON(%j) -> %s', (value, expected) => {
    expect(stringifyJSON(value)).toBe(expected);
  });

  test('rejects values JSON can not represent', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expectToThrowCode(() => stringifyJSON(undefined), ERRORS.FAILED_TO_STRINGIFY_JSON);
    expectToThrowCode(() => stringifyJSON(() => 1), ERRORS.FAILED_TO_STRINGIFY_JSON);
    expectToThrowCode(() => stringifyJSON(Symbol('id')), ERRORS.FAILED_TO_STRINGIFY_JSON);
    expectToThrowCode(() => stringifyJSON(10n), ERRORS.FAILED_TO_STRINGIFY_JSON);
    expectToThrowCode(() => stringifyJSON(circular), ERRORS.FAILED_TO_STRINGIFY_JSON);
  });
});
