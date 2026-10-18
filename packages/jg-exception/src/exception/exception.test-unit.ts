import { inspect } from 'node:util';
import { describe, expect, expectTypeOf, test } from 'vitest';

import { extractMessage, hasErrorCode } from '../error-handler/index.js';
import { UNKNOWN_ERROR_CODE } from '../shared/constants.js';
import type { IJsonValue } from '../shared/types.js';
import { Exception } from './exception.js';
import type { IExceptionJson, IExceptionOptions, IExceptionSeverity } from './types.js';
import { isException } from './utilities.js';

/**
 * Prints everything a value holds, hidden properties and whole strings included, the way a logger
 * or a debugger could show it.
 * @param value The value.
 * @returns The printed value.
 */
const inspectAll = (value: unknown): string =>
  inspect(value, { depth: null, showHidden: true, maxArrayLength: null, maxStringLength: null });

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

describe('Exception with redact', () => {
  test('redacts the message before the exception is built, so its stack never holds a value', () => {
    const exception = new Exception('Token tok_live_1 was rejected.', {
      code: 'TOKEN_REJECTED',
      redact: ['tok_live_1'],
    });

    expect(exception.message).toBe('Token [redacted] was rejected.');
    expect(exception.stack).toContain('Token [redacted] was rejected.');
    expect(exception.stack).not.toContain('tok_live_1');
  });

  test('redacts each value as written and URL-encoded, and values that overlap', () => {
    const exception = new Exception('GET /verify?token=a%20b%26c failed for abc123x and a b&c', {
      code: 'VERIFY_FAILED',
      redact: ['a b&c', 'abc123', 'c123x'],
    });

    expect(exception.message).toBe(
      'GET /verify?token=[redacted] failed for [redacted] and [redacted]',
    );
  });

  test('ignores empty and repeated values', () => {
    const exception = new Exception('tok_live_2 and tok_live_2', {
      code: 'FAILED',
      redact: ['tok_live_2', 'tok_live_2', ''],
    });

    expect(exception.message).toBe('[redacted] and [redacted]');
  });

  test.each([
    ['no list', undefined],
    ['an empty list', []],
    ['only empty values', ['']],
  ])('behaves as without redact when given %s', (_, redact) => {
    const data = { token: 'tok_live_3' };
    const cause = new Error('tok_live_3');
    const exception = new Exception('Failed for tok_live_3', {
      code: 'FAILED',
      data,
      cause,
      redact,
    });

    expect(exception.message).toBe('Failed for tok_live_3');
    expect(exception.data).toBe(data);
    expect(exception.cause).toBe(cause);
  });

  test('redacts every string in the data, at any depth, and keeps its keys', () => {
    const data = {
      token: 'tok_live_4',
      nested: { list: ['a', 'Bearer tok_live_4', { deep: 'tok_live_4' }] },
      count: 2,
      enabled: true,
      owner: null,
    };
    const exception = new Exception('Failed', { code: 'FAILED', data, redact: ['tok_live_4'] });

    expect(exception.data).toStrictEqual({
      token: '[redacted]',
      nested: { list: ['a', 'Bearer [redacted]', { deep: '[redacted]' }] },
      count: 2,
      enabled: true,
      owner: null,
    });
    expect(data.token).toBe('tok_live_4');
  });

  test("copies the data without running its getters, following a cycle, or leaving JSON's shape", () => {
    const list = Object.assign(['tok_live_5', () => 1], { label: 'tok_live_5' });
    const data: Record<string | symbol, unknown> = {
      list,
      run: () => 1,
      size: 1n,
      kind: Symbol('kind'),
      [Symbol('key')]: 'tok_live_5',
      parsed: JSON.parse('{"__proto__":{"token":"tok_live_5"}}') as unknown,
    };
    data['self'] = data;
    Object.defineProperty(data, 'secret', {
      enumerable: true,
      get: () => {
        throw new Error('the getter ran');
      },
    });
    const exception = new Exception('Failed', {
      code: 'FAILED',
      data: data as IJsonValue,
      redact: ['tok_live_5'],
    });
    const copy = exception.data as Record<string, unknown>;

    expect(Object.keys(copy)).toStrictEqual(['list', 'parsed']);
    expect(copy['list']).toStrictEqual(['[redacted]', null]);
    expect(Object.getPrototypeOf(copy['parsed'])).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(copy['parsed'], '__proto__')?.value).toStrictEqual({
      token: '[redacted]',
    });
  });

  test('uses null for data nested too deeply to copy', () => {
    let data: IJsonValue = 'tok_live_6';
    for (let depth = 0; depth < 100_000; depth += 1) {
      data = [data];
    }
    const exception = new Exception('Failed', { code: 'FAILED', data, redact: ['tok_live_6'] });

    expect(exception.data).toBeNull();
  });

  test('turns a number whose digits hold a value into its redacted text', () => {
    const cause = Object.assign(new Error('Wrong code'), {
      otp: 482913,
      attempts: 3,
      big: 482913n,
      verified: false,
      tag: Symbol('482913'),
    });
    const exception = new Exception('Failed', {
      code: 'OTP_FAILED',
      data: { otp: 482913, attempts: 3 },
      cause,
      redact: ['482913'],
    });
    const snapshot = exception.cause as Record<string, unknown>;

    expect(exception.data).toStrictEqual({ otp: '[redacted]', attempts: 3 });
    expect(snapshot['otp']).toBe('[redacted]');
    expect(snapshot['attempts']).toBe(3);
    expect(snapshot['big']).toBe('[redacted]');
    expect(snapshot['verified']).toBe(false);
    expect(snapshot['tag']).toBe('Symbol([redacted])');
  });

  test('replaces an error cause with a snapshot that keeps its name, code, and plain fields', () => {
    const cause = Object.assign(new TypeError('connect failed for tok_live_7'), {
      code: 'ECONNRESET',
      errno: -104,
      detail: 'tok_live_7 was rejected',
      config: { headers: { authorization: 'tok_live_7' } },
    });
    const exception = new Exception("Couldn't call the provider.", {
      code: 'PROVIDER_FAILED',
      cause,
      redact: ['tok_live_7'],
    });
    const snapshot = exception.cause as Error & Record<string, unknown>;

    expect(snapshot).not.toBe(cause);
    expect(Object.getPrototypeOf(snapshot)).toBe(Error.prototype);
    expect(snapshot.name).toBe('TypeError');
    expect(snapshot.message).toBe('connect failed for [redacted]');
    expect(snapshot.stack).toContain('TypeError: connect failed for [redacted]');
    expect(snapshot.stack).not.toContain('tok_live_7');
    expect(snapshot['code']).toBe('ECONNRESET');
    expect(snapshot['errno']).toBe(-104);
    expect(snapshot['detail']).toBe('[redacted] was rejected');
    expect('config' in snapshot).toBe(false);
    expect(hasErrorCode(snapshot, 'ECONNRESET')).toBe(true);
    expect(cause.message).toBe('connect failed for tok_live_7');
  });

  test('redacts the whole chain, so each layer still reads and keeps its code', () => {
    const root = Object.assign(new Error('tok_live_8 expired'), { code: 'TOKEN_EXPIRED' });
    const refresh = new Exception('The refresh failed.', { code: 'REFRESH_FAILED', cause: root });
    const exception = new Exception('Sign-in failed.', {
      code: 'SIGN_IN_FAILED',
      cause: refresh,
      redact: ['tok_live_8'],
    });
    const first = exception.cause as Exception;
    const second = first.cause as Error;

    expect(extractMessage(exception)).toBe(
      'Sign-in failed.; [CAUSE]: The refresh failed.; [CAUSE]: [redacted] expired',
    );
    expect(first.data).toBeUndefined();
    expect(hasErrorCode(first, 'REFRESH_FAILED')).toBe(true);
    expect(hasErrorCode(second, 'TOKEN_EXPIRED')).toBe(true);
  });

  test('keeps an Exception cause an Exception, with its name, code, and redacted data', () => {
    class ApiException extends Exception {
      public readonly httpStatus: number;

      constructor(message: string, code: string, data: IJsonValue, httpStatus: number) {
        super(message, { code, data });
        this.name = 'ApiException';
        this.httpStatus = httpStatus;
      }
    }
    const cause = new ApiException(
      'The upstream rejected tok_live_9.',
      'UPSTREAM_REJECTED',
      { token: 'tok_live_9', retries: 2 },
      502,
    );
    const exception = new Exception('Failed', { code: 'FAILED', cause, redact: ['tok_live_9'] });
    const snapshot = exception.cause as Exception & Record<string, unknown>;

    expect(isException(snapshot)).toBe(true);
    expect(snapshot).toBeInstanceOf(Exception);
    expect(snapshot).not.toBeInstanceOf(ApiException);
    expect(snapshot.toJSON()).toStrictEqual({
      name: 'ApiException',
      code: 'UPSTREAM_REJECTED',
      message: 'The upstream rejected [redacted].',
      data: { token: '[redacted]', retries: 2 },
    });
    expect(snapshot.toString()).toBe(
      'ApiException [UPSTREAM_REJECTED]: The upstream rejected [redacted].',
    );
    expect(snapshot['httpStatus']).toBe(502);
    expect(hasErrorCode(snapshot, 'UPSTREAM_REJECTED')).toBe(true);
  });

  test("copies a cause that isn't an Error into an Error, without a stack it never had", () => {
    const exception = new Exception('Failed', {
      code: 'FAILED',
      cause: { message: 'tok_live_10 refused', status: 401, response: { body: 'tok_live_10' } },
      redact: ['tok_live_10'],
    });
    const snapshot = exception.cause as Error & Record<string, unknown>;
    const fromFunction = new Exception('Failed', {
      code: 'FAILED',
      cause: Object.assign(() => 1, { reason: 'tok_live_10' }),
      redact: ['tok_live_10'],
    });

    expect(snapshot).toBeInstanceOf(Error);
    expect(snapshot.name).toBe('Error');
    expect(snapshot.message).toBe('[redacted] refused');
    expect(snapshot['status']).toBe(401);
    expect('response' in snapshot).toBe(false);
    expect(Object.getOwnPropertyNames(snapshot)).not.toContain('stack');
    expect((fromFunction.cause as Record<string, unknown>)['reason']).toBe('[redacted]');
  });

  test('redacts a string cause, and keeps other primitive causes', () => {
    const redact = ['tok_live_11'];

    expect(
      new Exception('Failed', { code: 'FAILED', cause: 'bad tok_live_11', redact }).cause,
    ).toBe('bad [redacted]');
    expect(new Exception('Failed', { code: 'FAILED', cause: 404, redact }).cause).toBe(404);
    expect(new Exception('Failed', { code: 'FAILED', cause: null, redact }).cause).toBeNull();
    expect('cause' in new Exception('Failed', { code: 'FAILED', redact })).toBe(false);
  });

  test('keeps a cyclic chain cyclic, with each cause copied once', () => {
    const first = new Error('first tok_live_12');
    const second = new Error('second', { cause: first });
    first.cause = second;
    const exception = new Exception('Failed', {
      code: 'FAILED',
      cause: first,
      redact: ['tok_live_12'],
    });
    const snapshot = exception.cause as Error;

    expect((snapshot.cause as Error).cause).toBe(snapshot);
    expect(inspectAll(exception)).not.toContain('tok_live_12');
  });

  test("runs none of the code on a cause's class when the exception is inspected", () => {
    const secret = 'tok_live_13';
    class LeakyError extends Error {
      public get detail(): string {
        return secret;
      }

      public [inspect.custom](): string {
        return `LeakyError holding ${secret}`;
      }
    }
    Object.defineProperty(LeakyError.prototype, 'name', { get: () => `LeakyError ${secret}` });
    class PrivateError extends Error {
      readonly #token = 'tok_live_14';

      public [inspect.custom](): string {
        return this.#token;
      }
    }
    const leaky = new Exception('Failed', {
      code: 'FAILED',
      cause: new LeakyError('The lookup failed.'),
      redact: [secret],
    });
    const withPrivate = new Exception('Failed', {
      code: 'FAILED',
      cause: new PrivateError('Denied'),
      redact: ['tok_live_14'],
    });

    expect(inspectAll(leaky)).not.toContain(secret);
    expect(Object.getPrototypeOf(leaky.cause)).toBe(Error.prototype);
    expect((leaky.cause as Error).name).toBe('Error');
    expect(() => inspectAll(withPrivate)).not.toThrow();
    expect(inspectAll(withPrivate)).not.toContain('tok_live_14');
  });

  test('leaves out what a getter or a proxy that throws would give, and still builds', () => {
    const throwing = (): never => {
      throw new Error('the trap ran');
    };
    const withGetter = new Error('Failed');
    Object.defineProperty(withGetter, 'details', { enumerable: true, get: throwing });
    const blocked = new Proxy(new Error('hidden'), {
      get: throwing,
      getOwnPropertyDescriptor: throwing,
      getPrototypeOf: throwing,
      has: throwing,
      ownKeys: throwing,
    });
    const unreadable = new Proxy(new Error('hidden'), { getOwnPropertyDescriptor: throwing });
    const endless: object = new Proxy({}, { getPrototypeOf: () => endless });
    const build = (cause: unknown) =>
      new Exception('Failed', { code: 'FAILED', cause, redact: ['tok_live_15'] }).cause as Error;

    expect('details' in build(withGetter)).toBe(false);
    for (const cause of [blocked, unreadable, endless]) {
      const snapshot = build(cause);

      expect(snapshot).toBeInstanceOf(Error);
      expect(snapshot.name).toBe('Error');
      expect(snapshot.message).toBe('');
      expect(() => inspectAll(snapshot)).not.toThrow();
    }
  });

  test('builds the exception without the causes of a chain too deep to copy', () => {
    let cause = new Error('root tok_live_16');
    for (let depth = 0; depth < 50_000; depth += 1) {
      cause = new Error('layer', { cause });
    }
    const build = () => new Exception('Failed', { code: 'FAILED', cause, redact: ['tok_live_16'] });

    expect(build).not.toThrow();
    expect((build().cause as Error).message).toBe('layer');
  });

  test('reads what an untyped caller passes, skipping what it cannot use', () => {
    const partlyReadable = new Proxy(['tok_live_17', 'unread'], {
      get: (target, key) => {
        if (key === '1') {
          throw new Error('the trap ran');
        }
        return Reflect.get(target, key) as unknown;
      },
    });
    const build = (message: unknown, redact: unknown) =>
      new Exception(message as string, { code: 'FAILED', redact: redact as string[] });

    expect(build('tok_live_17', 'tok_live_17').message).toBe('tok_live_17');
    expect(build('tok_live_17 482913', [482913, 'tok_live_17']).message).toBe('[redacted] 482913');
    expect(build('tok_live_17 unread', partlyReadable).message).toBe('[redacted] unread');
    expect(build(482913, ['482913']).message).toBe('[redacted]');
    expect(build(Symbol('tok_live_17'), ['tok_live_17']).message).toBe('');
    // a lone surrogate has no URL-encoded form, so it's matched as written
    expect(build('a \uD800 b', ['\uD800']).message).toBe('a [redacted] b');
  });

  test('keeps the values nowhere: printing everything shows neither them nor the option', () => {
    const value = 'tok_live_18';
    const exception = new Exception(`Token ${value} failed`, {
      code: 'FAILED',
      data: { token: value },
      cause: new Exception(`Inner ${value}`, {
        code: 'INNER',
        data: [value],
        cause: Object.assign(new Error(`Root ${value}`), { token: value }),
      }),
      redact: [value],
    });

    expect(inspectAll(exception)).not.toContain(value);
    expect(inspectAll(exception)).not.toMatch(/\bredact\b/);
    expect(extractMessage(exception)).not.toContain(value);
    expect(JSON.stringify(exception)).not.toContain(value);
    expect(exception.toString()).not.toContain(value);
  });
});

describe('Exception with severity and shouldLog', () => {
  test('keeps a known severity and shouldLog set to true', () => {
    const expected = new Exception('Not found', { code: 'NOT_FOUND', severity: 'expected' });
    const critical = new Exception('Ledger mismatch', {
      code: 'LEDGER_MISMATCH',
      severity: 'critical',
      shouldLog: true,
    });

    expect(expected.severity).toBe('expected');
    expect(Object.hasOwn(expected, 'shouldLog')).toBe(false);
    expect(critical.severity).toBe('critical');
    expect(critical.shouldLog).toBe(true);
  });

  test.each([
    ['no options', {}],
    ['an unknown severity', { severity: 'fatal' }],
    ['shouldLog set to false', { shouldLog: false }],
    ['a shouldLog that is not true', { shouldLog: 'yes' }],
    ['undefined values', { severity: undefined, shouldLog: undefined }],
  ])('has neither field with %s', (_, flags) => {
    // the flags as an untyped caller passes them
    const exception = new Exception('Failed', { code: 'FAILED', ...flags } as IExceptionOptions);

    expect(Object.hasOwn(exception, 'severity')).toBe(false);
    expect(Object.hasOwn(exception, 'shouldLog')).toBe(false);
    expect('severity' in exception).toBe(false);
    expect('shouldLog' in exception).toBe(false);
  });

  test('leaves an Exception without them with the same own properties as before', () => {
    const exception = new Exception('Not found', { code: 'NOT_FOUND', data: { id: 1 } });

    expect(Object.keys(exception)).toStrictEqual(['code', 'data', 'name']);
  });

  test('never serializes them', () => {
    const exception = new Exception('Ledger mismatch', {
      code: 'LEDGER_MISMATCH',
      data: { id: 1 },
      severity: 'critical',
      shouldLog: true,
    });

    expect(exception.toJSON()).toStrictEqual({
      name: 'Exception',
      code: 'LEDGER_MISMATCH',
      message: 'Ledger mismatch',
      data: { id: 1 },
    });
    expect(JSON.stringify(exception)).toBe(
      '{"name":"Exception","code":"LEDGER_MISMATCH","message":"Ledger mismatch","data":{"id":1}}',
    );
    expect(exception.toString()).toBe('Exception [LEDGER_MISMATCH]: Ledger mismatch');
  });

  test("copies a cause's flags verbatim into its snapshot, whatever the values to redact", () => {
    const cause = new Exception('The ledger is critical and true', {
      code: 'LEDGER_MISMATCH',
      severity: 'critical',
      shouldLog: true,
    });
    const exception = new Exception('Failed', {
      code: 'FAILED',
      cause,
      redact: ['true', 'critical'],
    });
    const snapshot = exception.cause as Exception;

    expect(snapshot).not.toBe(cause);
    expect(isException(snapshot)).toBe(true);
    expect(snapshot.message).toBe('The ledger is [redacted] and [redacted]');
    expect(snapshot.severity).toBe('critical');
    expect(snapshot.shouldLog).toBe(true);
  });

  test("redacts the same fields on a cause that isn't an Exception", () => {
    const cause = Object.assign(new Error('Failed'), { severity: 'critical', shouldLog: true });
    const exception = new Exception('Failed', {
      code: 'FAILED',
      cause,
      redact: ['true', 'critical'],
    });
    const snapshot = exception.cause as Error & Record<string, unknown>;

    expect(snapshot['severity']).toBe('[redacted]');
    expect(snapshot['shouldLog']).toBe('[redacted]');
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

  test('accepts a readonly list of values to redact', () => {
    const secrets = ['tok_live_19'] as const;

    expect(new Exception('Failed', { code: 'FAILED', redact: secrets }).code).toBe('FAILED');
    expectTypeOf<IExceptionOptions['redact']>().toEqualTypeOf<readonly string[] | undefined>();
  });

  test('accepts only the known severities and a boolean shouldLog', () => {
    // @ts-expect-error: the severity is one of the known ones
    expect(new Exception('Failed', { code: 'FAILED', severity: 'fatal' }).code).toBe('FAILED');
    // @ts-expect-error: shouldLog is a boolean
    expect(new Exception('Failed', { code: 'FAILED', shouldLog: 'yes' }).code).toBe('FAILED');
    expectTypeOf<IExceptionSeverity>().toEqualTypeOf<'expected' | 'critical'>();
  });

  test('types the data and the JSON form', () => {
    const exception = new Exception('Not found', { code: 'NOT_FOUND' });

    expectTypeOf(exception.code).toEqualTypeOf<string>();
    expectTypeOf(exception.data).toEqualTypeOf<IJsonValue | undefined>();
    expectTypeOf(exception.severity).toEqualTypeOf<IExceptionSeverity | undefined>();
    expectTypeOf(exception.shouldLog).toEqualTypeOf<boolean | undefined>();
    expectTypeOf(exception.toJSON()).toEqualTypeOf<IExceptionJson>();
    expectTypeOf(exception.toJSON().data).toEqualTypeOf<IJsonValue>();
  });
});
