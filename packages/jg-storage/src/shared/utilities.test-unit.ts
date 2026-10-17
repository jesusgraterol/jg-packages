import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import { ERRORS } from './errors.js';
import {
  assertStoreId,
  buildDataKey,
  buildIndexedDbKey,
  parseJson,
  parseValue,
  stringifyJson,
} from './utilities.js';

describe('buildDataKey', () => {
  test.each([
    ['settings', undefined, 'jg-storage:settings'],
    ['settings', 'draft', 'jg-storage:settings:draft'],
    ['settings', 655643215461, 'jg-storage:settings:655643215461'],
    ['settings', '', 'jg-storage:settings:'],
    ['settings', 'a:b', 'jg-storage:settings:a:b'],
  ])('buildDataKey(%s, %s) -> %s', (storeId, recordId, expected) => {
    expect(buildDataKey(storeId, recordId)).toBe(expected);
  });

  test('gives 1 and "1" the same key', () => {
    expect(buildDataKey('settings', 1)).toBe(buildDataKey('settings', '1'));
  });
});

describe('buildIndexedDbKey', () => {
  test.each([
    ['devices', undefined, ['devices']],
    ['devices', 'phone', ['devices', 'phone']],
    ['devices', 1, ['devices', '1']],
  ])('buildIndexedDbKey(%s, %s) -> %o', (storeId, recordId, expected) => {
    expect(buildIndexedDbKey(storeId, recordId)).toStrictEqual(expected);
  });
});

describe('assertStoreId', () => {
  test.each(['settings', 'wizard-step', 'user_1', 'probe', 'A9'])('accepts %s', (storeId) => {
    expect(() => assertStoreId(storeId)).not.toThrow();
  });

  test.each(['', 'a:b', 'a b', 'ä', 'a/b', 'jg-storage:x', ' settings'])(
    'rejects %o with INVALID_STORE_ID',
    (storeId) => {
      expectToThrowCode(() => assertStoreId(storeId), ERRORS.INVALID_STORE_ID);
    },
  );

  test('rejects ids that are not strings, from untyped callers', () => {
    expectToThrowCode(() => assertStoreId(undefined as unknown as string), ERRORS.INVALID_STORE_ID);
    expectToThrowCode(() => assertStoreId(1 as unknown as string), ERRORS.INVALID_STORE_ID);
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

describe('parseJson', () => {
  test.each([
    ['{"foo":"bar"}', { foo: 'bar' }],
    ['[1,2,3]', [1, 2, 3]],
    ['"text"', 'text'],
    ['12.5', 12.5],
    ['true', true],
    ['null', null],
  ])('parseJson(%s) -> %j', (data, expected) => {
    expect(parseJson(data)).toStrictEqual(expected);
  });

  test.each(['{foo}', 'undefined', 'text', ''])('rejects %j', (data) => {
    expectToThrowCode(() => parseJson(data), ERRORS.FAILED_TO_PARSE_JSON);
  });
});

describe('stringifyJson', () => {
  test.each([
    [{ foo: 'bar' }, '{"foo":"bar"}'],
    [[1, 2, 3], '[1,2,3]'],
    ['text', '"text"'],
    [12.5, '12.5'],
    [false, 'false'],
    [null, 'null'],
  ])('stringifyJson(%j) -> %s', (value, expected) => {
    expect(stringifyJson(value)).toBe(expected);
  });

  test('rejects values JSON can not represent', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expectToThrowCode(() => stringifyJson(undefined), ERRORS.FAILED_TO_STRINGIFY_JSON);
    expectToThrowCode(() => stringifyJson(() => 1), ERRORS.FAILED_TO_STRINGIFY_JSON);
    expectToThrowCode(() => stringifyJson(Symbol('id')), ERRORS.FAILED_TO_STRINGIFY_JSON);
    expectToThrowCode(() => stringifyJson(10n), ERRORS.FAILED_TO_STRINGIFY_JSON);
    expectToThrowCode(() => stringifyJson(circular), ERRORS.FAILED_TO_STRINGIFY_JSON);
  });
});
