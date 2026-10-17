import { describe, expect, expectTypeOf, test } from 'vitest';

import { extractMessage } from '../error-handler/index.js';
import { UNKNOWN_ERROR_CODE } from '../shared/constants.js';
import type { IJsonValue } from '../shared/types.js';
import { Exception } from './exception.js';
import type { IExceptionJson } from './types.js';

describe('Exception', () => {
  test('is an Error with the message, the code, and the data', () => {
    const exception = new Exception('The user was not found.', {
      code: 'USER_NOT_FOUND',
      data: { id: 1 },
    });

    expect(exception).toBeInstanceOf(Error);
    expect(exception).toBeInstanceOf(Exception);
    expect(exception.name).toBe('Exception');
    expect(exception.message).toBe('The user was not found.');
    expect(exception.code).toBe('USER_NOT_FOUND');
    expect(exception.data).toStrictEqual({ id: 1 });
    expect(exception.stack).toContain('The user was not found.');
  });

  test('has no data and no cause unless they are given', () => {
    const exception = new Exception('Not found', { code: 'NOT_FOUND' });

    expect(exception.data).toBeUndefined();
    expect('cause' in exception).toBe(false);
  });

  test('keeps the cause as the native cause, without adding it to the message', () => {
    const cause = new Error('network timeout');
    const exception = new Exception('Unable to send the receipt email.', {
      code: 'RECEIPT_EMAIL_FAILED',
      cause,
    });

    expect(exception.message).toBe('Unable to send the receipt email.');
    expect(exception.cause).toBe(cause);
    expect(extractMessage(exception)).toBe(
      'Unable to send the receipt email.; [CAUSE]: network timeout',
    );
  });

  test('prints each layer of a wrapped chain once', () => {
    const root = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    const query = new Exception("The user query couldn't run.", {
      code: 'QUERY_FAILED',
      cause: root,
    });
    const exception = new Exception("Couldn't load the user.", {
      code: 'USER_LOAD_FAILED',
      cause: query,
    });
    const message = extractMessage(exception);

    expect(message).toBe(
      "Couldn't load the user.; [CAUSE]: The user query couldn't run.; [CAUSE]: connect ECONNREFUSED 127.0.0.1:5432",
    );
    for (const layer of [exception.message, query.message, root.message]) {
      expect(message.split(layer)).toHaveLength(2);
    }
  });

  test.each([
    ['false', false],
    ['zero', 0],
    ['an empty string', ''],
    ['null', null],
  ])('keeps %s as the cause', (_, cause) => {
    const exception = new Exception('Feature disabled', { code: 'FEATURE_DISABLED', cause });

    expect(exception.cause).toBe(cause);
    expect(extractMessage(exception)).toBe('Feature disabled');
  });

  test('uses the unknown error code when untyped callers leave the code out', () => {
    // @ts-expect-error: calls it the way untyped JavaScript callers can
    expect(new Exception('Failed').code).toBe(UNKNOWN_ERROR_CODE);
    // @ts-expect-error: calls it the way untyped JavaScript callers can
    expect(new Exception('Failed', {}).code).toBe(UNKNOWN_ERROR_CODE);
    // @ts-expect-error: calls it the way untyped JavaScript callers can
    expect(new Exception('Failed', { code: 404 }).code).toBe(UNKNOWN_ERROR_CODE);
    expect(new Exception('Failed', { code: '' }).code).toBe(UNKNOWN_ERROR_CODE);
  });

  test('describes itself in one line with toString', () => {
    const exception = new Exception('Not found', { code: 'NOT_FOUND', data: { id: 1 } });

    expect(exception.toString()).toBe('Exception [NOT_FOUND]: Not found');
    expect(String(exception)).toBe('Exception [NOT_FOUND]: Not found');
    expect(`${exception}`).toBe('Exception [NOT_FOUND]: Not found');
  });

  test('uses the name of a subclass in toString and toJSON', () => {
    class StorageException extends Exception {
      constructor(message: string, code: string) {
        super(message, { code });
        this.name = 'StorageException';
      }
    }
    const exception = new StorageException('Quota exceeded', 'QUOTA_EXCEEDED');

    expect(exception.toString()).toBe('StorageException [QUOTA_EXCEEDED]: Quota exceeded');
    expect(exception.toJSON().name).toBe('StorageException');
  });
});

describe('Exception#toJSON', () => {
  test('returns the name, code, message, and data', () => {
    const exception = new Exception('Not found', {
      code: 'NOT_FOUND',
      data: { id: 1, tags: ['a'], deleted: false, owner: null },
      cause: new Error('missing row'),
    });

    expect(exception.toJSON()).toStrictEqual({
      name: 'Exception',
      code: 'NOT_FOUND',
      message: 'Not found',
      data: { id: 1, tags: ['a'], deleted: false, owner: null },
    });
  });

  test('is what JSON.stringify writes, with null when there is no data', () => {
    const exception = new Exception('Not found', { code: 'NOT_FOUND' });

    expect(JSON.parse(JSON.stringify(exception))).toStrictEqual({
      name: 'Exception',
      code: 'NOT_FOUND',
      message: 'Not found',
      data: null,
    });
  });

  test('gives the data as JSON carries it', () => {
    const exception = new Exception('Invalid', {
      code: 'INVALID',
      data: { email: undefined, ratio: Number.NaN, limit: Number.POSITIVE_INFINITY },
    });

    expect(exception.toJSON().data).toStrictEqual({ ratio: null, limit: null });
  });

  test('copies the data, so changing the result leaves the exception alone', () => {
    const data = { ids: [1, 2] };
    const json = new Exception('Invalid', { code: 'INVALID', data }).toJSON();
    (json.data as { ids: number[] }).ids.push(3);

    expect(data).toStrictEqual({ ids: [1, 2] });
  });

  test.each([
    [
      'refers back to itself',
      (() => {
        const data: Record<string, unknown> = { id: 1 };
        data['self'] = data;
        return data;
      })(),
    ],
    ['contains a BigInt', { id: 1n }],
    ['is a function', () => 1],
    ['is a symbol', Symbol('data')],
  ])('uses null for data that %s', (_, data) => {
    const exception = new Exception('Failed', {
      code: 'FAILED',
      data: data as unknown as IJsonValue,
    });

    expect(exception.toJSON().data).toBeNull();
    expect(() => JSON.stringify(exception)).not.toThrow();
    expect(JSON.parse(JSON.stringify(exception))).toMatchObject({ code: 'FAILED', data: null });
  });
});

describe('Exception types', () => {
  test('requires a string code', () => {
    // @ts-expect-error: the options are required
    expect(() => new Exception('Failed')).not.toThrow();
    // @ts-expect-error: the code is required
    expect(() => new Exception('Failed', { data: { id: 1 } })).not.toThrow();
    // @ts-expect-error: the code is a string
    expect(() => new Exception('Failed', { code: 404 })).not.toThrow();
  });

  test('accepts JSON data, including objects with optional fields', () => {
    const email: string | undefined = undefined as string | undefined;
    type IUserRow = { id: number; email?: string | undefined };
    const row: IUserRow = { id: 1 };

    expect(new Exception('Invalid', { code: 'INVALID', data: { email } }).data).toStrictEqual({
      email: undefined,
    });
    expect(new Exception('Invalid', { code: 'INVALID', data: row }).data).toBe(row);
    expect(new Exception('Invalid', { code: 'INVALID', data: [1, 'a', null] }).data).toBeDefined();
  });

  test('accepts an interface-typed value spread into an object', () => {
    interface IUser {
      id: number;
      email: string;
    }
    const user: IUser = { id: 1, email: 'ada@example.com' };

    // @ts-expect-error: an interface has no index signature, so it isn't known to be JSON
    expect(new Exception('Invalid', { code: 'INVALID', data: user }).data).toBe(user);
    expect(new Exception('Invalid', { code: 'INVALID', data: { ...user } }).data).toStrictEqual(
      user,
    );
  });

  test('rejects data that JSON cannot carry', () => {
    class Point {
      constructor(public readonly x: number) {}
    }

    // @ts-expect-error: a BigInt isn't JSON
    expect(new Exception('Invalid', { code: 'INVALID', data: { id: 1n } }).code).toBe('INVALID');
    // @ts-expect-error: a Date isn't JSON
    expect(new Exception('Invalid', { code: 'INVALID', data: new Date(0) }).code).toBe('INVALID');
    // @ts-expect-error: a class instance isn't JSON
    expect(new Exception('Invalid', { code: 'INVALID', data: new Point(1) }).code).toBe('INVALID');
    // @ts-expect-error: a function isn't JSON
    expect(new Exception('Invalid', { code: 'INVALID', data: { run: () => 1 } }).code).toBe(
      'INVALID',
    );
  });

  test('types the data and the JSON form', () => {
    const exception = new Exception('Not found', { code: 'NOT_FOUND' });

    expectTypeOf(exception.code).toEqualTypeOf<string>();
    expectTypeOf(exception.data).toEqualTypeOf<IJsonValue | undefined>();
    expectTypeOf(exception.toJSON()).toEqualTypeOf<IExceptionJson>();
    expectTypeOf(exception.toJSON().data).toEqualTypeOf<IJsonValue>();
  });
});
