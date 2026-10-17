import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, vi, test, expect } from 'vitest';
import { z, type ZodType } from 'zod';
import { Exception } from '../exception/index.js';
import { DEFAULT_MESSAGE } from '../shared/constants.js';
import {
  extractMessage,
  extractRedactedMessage,
  isDefaultErrorMessage,
  getErrorCode,
  hasErrorCodePrefix,
  hasErrorCode,
} from './index.js';

/* ************************************************************************************************
 *                                             TESTS                                              *
 ************************************************************************************************ */

describe('extractMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns the default error msg if an invalid value is provided', () => {
    // @ts-expect-error: calls it the way untyped JavaScript callers can
    expect(extractMessage()).toBe(DEFAULT_MESSAGE);
    expect(extractMessage('')).toBe(DEFAULT_MESSAGE);
    expect(extractMessage(undefined)).toBe(DEFAULT_MESSAGE);
    expect(extractMessage(null)).toBe(DEFAULT_MESSAGE);
    expect(extractMessage(true)).toBe(DEFAULT_MESSAGE);
    expect(extractMessage(false)).toBe(DEFAULT_MESSAGE);
    expect(extractMessage(0)).toBe(DEFAULT_MESSAGE);
    expect(extractMessage(1)).toBe(DEFAULT_MESSAGE);
  });

  test('can extract a message that is passed in string format', () => {
    expect(extractMessage('This is a nasty error!')).toBe('This is a nasty error!');
  });

  test('can extract a message from an error instance', () => {
    expect(extractMessage(new Error('This is a nasty error!'))).toBe('This is a nasty error!');
    expect(extractMessage(new TypeError('This is a nasty type error!'))).toBe(
      'This is a nasty type error!',
    );
    expect(extractMessage(new ReferenceError('This is a nasty reference error!'))).toBe(
      'This is a nasty reference error!',
    );
    expect(extractMessage(new SyntaxError('This is a nasty syntax error!'))).toBe(
      'This is a nasty syntax error!',
    );
    expect(extractMessage(new RangeError('This is a nasty range error!'))).toBe(
      'This is a nasty range error!',
    );
    expect(extractMessage(new EvalError('This is a nasty eval error!'))).toBe(
      'This is a nasty eval error!',
    );
    expect(extractMessage(new URIError('This is a nasty uri error!'))).toBe(
      'This is a nasty uri error!',
    );
    expect(extractMessage(new AggregateError(['error 1', 'error 2', 'error 3']))).toStrictEqual(
      JSON.stringify(['error 1', 'error 2', 'error 3']),
    );
  });

  test('can extract a message from an error instance with cause', () => {
    const cause = new Error('I AM THE CAUSE!');
    const cause2 = new ReferenceError('I AM THE OTHER CAUSE!');
    expect(extractMessage(new Error('This is a nasty error!', { cause }))).toBe(
      'This is a nasty error!; [CAUSE]: I AM THE CAUSE!',
    );
    expect(extractMessage(new TypeError('This is a type error!', { cause }))).toBe(
      'This is a type error!; [CAUSE]: I AM THE CAUSE!',
    );
    expect(extractMessage(new Error('This is an error!', { cause: cause2 }))).toBe(
      'This is an error!; [CAUSE]: I AM THE OTHER CAUSE!',
    );
  });

  test('can extract a message from an error instance with deeply nested causes', () => {
    expect(
      extractMessage(
        new Error('Top level error', {
          cause: new Error('First nested cause', {
            cause: new Error('Second nested cause'),
          }),
        }),
      ),
    ).toBe('Top level error; [CAUSE]: First nested cause; [CAUSE]: Second nested cause');
  });

  test('returns the default message for circular Error cause references', () => {
    const error = new Error('Top level error');

    error.cause = error;

    expect(extractMessage(error)).toBe(`Top level error; [CAUSE]: ${DEFAULT_MESSAGE}`);
  });

  test('returns a stringified version of the error if it cannot extract the message from an object', () => {
    expect(extractMessage(['some', 'weird', 'error'])).toBe(
      JSON.stringify(['some', 'weird', 'error']),
    );
    expect(extractMessage({ omg: 'no error keys!', foo: 'bar' })).toBe(
      JSON.stringify({ omg: 'no error keys!', foo: 'bar' }),
    );
  });

  test('returns the default message when fallback stringification fails', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error: Record<string, unknown> = {};

    error['self'] = error;

    expect(extractMessage(error)).toBe(DEFAULT_MESSAGE);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('can extract a message from within an object', () => {
    expect(extractMessage({ message: 'Ops! something went wrong', msg: 'did it?' })).toBe(
      'Ops! something went wrong',
    );
    expect(extractMessage({ msg: 'The msg key is used by some APIs' })).toBe(
      'The msg key is used by some APIs',
    );
    expect(extractMessage({ error: 'The error key is used by some APIs' })).toBe(
      'The error key is used by some APIs',
    );
    expect(extractMessage({ err: 'The err key is used by some APIs' })).toBe(
      'The err key is used by some APIs',
    );
    expect(extractMessage({ errors: 'The errors key is used by some APIs' })).toBe(
      'The errors key is used by some APIs',
    );
    expect(extractMessage({ errs: 'The errs key is used by some APIs' })).toBe(
      'The errs key is used by some APIs',
    );
    expect(extractMessage({ reason: 'The reason key is used by some APIs' })).toBe(
      'The reason key is used by some APIs',
    );
    expect(extractMessage({ reasons: 'The reason key is used by some APIs' })).toBe(
      'The reason key is used by some APIs',
    );
    expect(extractMessage({ issue: 'The issue key is used by some APIs' })).toBe(
      'The issue key is used by some APIs',
    );
    expect(extractMessage({ issues: 'The issues key is used by some APIs' })).toBe(
      'The issues key is used by some APIs',
    );
    expect(extractMessage({ data: { someKey: 'someValue', someOtherKey: 123456 } })).toBe(
      JSON.stringify({ someKey: 'someValue', someOtherKey: 123456 }),
    );
  });

  test('can extract a message when is deeply nested within an object', () => {
    expect(extractMessage({ error: { err: { error: 'Oh my god! So nested :)' } } })).toBe(
      'Oh my god! So nested :)',
    );
    expect(
      extractMessage({ message: { err: { message: 'This error message is nested deeply!' } } }),
    ).toBe('This error message is nested deeply!');
  });

  test.each([
    'message',
    'msg',
    'error',
    'err',
    'errors',
    'errs',
    'reason',
    'reasons',
    'issue',
    'issues',
    'data',
  ])('returns the default message for circular %s references', (errorKey) => {
    const error: Record<string, unknown> = {};

    error[errorKey] = error;

    expect(extractMessage(error)).toBe(DEFAULT_MESSAGE);
  });

  test('can extract a message from ZodErrors', () => {
    try {
      z.object({ name: z.string() }).parse({ name: 123 });
    } catch (error) {
      expect(extractMessage(error)).toBe('Invalid input: expected string, received number (name)');
    }

    try {
      z.object({ name: z.object({ age: z.number() }) }).parse({ name: { age: 'not a number' } });
    } catch (error) {
      expect(extractMessage(error)).toBe(
        'Invalid input: expected number, received string (name.age)',
      );
    }

    try {
      z.object({
        someDict: z.object({ innerList: z.array(z.object({ someProp: z.string() })) }),
      }).parse({
        someDict: { innerList: [{ someProp: 123 }] },
      });
    } catch (error) {
      expect(extractMessage(error)).toBe(
        'Invalid input: expected string, received number (someDict.innerList.0.someProp)',
      );
    }
  });

  test.each<[string, ZodType, unknown, string]>([
    [
      'an invalid field type',
      z.object({ name: z.string({ error: 'Name must be a string.' }) }),
      { name: 123 },
      'Name must be a string. (name)',
    ],
    [
      'a failed field constraint',
      z.object({ name: z.string().min(1, { error: 'Name is required.' }) }),
      { name: '' },
      'Name is required. (name)',
    ],
    [
      'a failed nested refinement',
      z.object({
        profile: z.object({
          age: z.number().refine((age) => age >= 18, { error: 'Age must be at least 18.' }),
        }),
      }),
      { profile: { age: 17 } },
      'Age must be at least 18. (profile.age)',
    ],
  ])('can extract a custom Zod schema message for %s', (_, schema, input, expectedMessage) => {
    const result = schema.safeParse(input);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(extractMessage(result.error)).toBe(expectedMessage);
    }
  });
});

describe('extractRedactedMessage', () => {
  test('extracts and redacts repeated sensitive values from an Error cause chain', () => {
    const error = new Error('Request failed for token secret-token.', {
      cause: new Error('The provider rejected secret-token.'),
    });

    expect(extractRedactedMessage(error, ['secret-token'])).toBe(
      'Request failed for token [redacted].; [CAUSE]: The provider rejected [redacted].',
    );
  });

  test('fully redacts shifted overlapping sensitive values', () => {
    expect(extractRedactedMessage(new Error('Provider returned abcd.'), ['abc', 'bcd'])).toBe(
      'Provider returned [redacted].',
    );
  });

  test.each([
    ['an empty list', []],
    ['an empty-string-only list', ['', '']],
    ['a non-matching list', ['different-value']],
  ])('returns the extracted message unchanged for %s', (_, sensitiveValues) => {
    const error = new Error('Request failed.');

    expect(extractRedactedMessage(error, sensitiveValues)).toBe(extractMessage(error));
  });
});

describe('isDefaultErrorMessage', () => {
  test('can identify the default error message', () => {
    expect(isDefaultErrorMessage(DEFAULT_MESSAGE)).toBe(true);
    expect(isDefaultErrorMessage(DEFAULT_MESSAGE, true)).toBe(true);
    expect(isDefaultErrorMessage(`${DEFAULT_MESSAGE} and something else...`)).toBe(true);
    expect(isDefaultErrorMessage(`${DEFAULT_MESSAGE} and something else...`, true)).toBe(false);
    expect(isDefaultErrorMessage('This is a nasty error!')).toBe(false);
    expect(isDefaultErrorMessage('This is a nasty error!', true)).toBe(false);
  });
});

describe('getErrorCode', () => {
  test('reads the code of an Exception', () => {
    expect(getErrorCode(new Exception('Not found', { code: 'NOT_FOUND' }))).toBe('NOT_FOUND');
  });

  test('reads the code of a Node.js system error', () => {
    let systemError: unknown;
    try {
      readFileSync(join(tmpdir(), 'jg-exception-missing-file'));
    } catch (error) {
      systemError = error;
    }

    expect(getErrorCode(systemError)).toBe('ENOENT');
  });

  test('reads a string code from plain objects and errors of any class', () => {
    expect(getErrorCode({ code: 'RATE_LIMITED', message: 'Slow down' })).toBe('RATE_LIMITED');
    expect(getErrorCode(Object.assign(new TypeError('Bad'), { code: 'BAD_TYPE' }))).toBe(
      'BAD_TYPE',
    );
  });

  test.each([
    ['a number', 404],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'NOT_FOUND'],
    ['an error without a code', new Error('Not found')],
    ['a numeric code', { code: 404 }],
    ['an empty code', { code: '' }],
    ['a null code', { code: null }],
    ['an array code', { code: ['NOT_FOUND'] }],
  ])('returns null for %s', (_, error) => {
    expect(getErrorCode(error)).toBeNull();
  });

  test('ignores a code written into the message', () => {
    expect(getErrorCode(new Error('Not found{(NOT_FOUND)}'))).toBeNull();
  });
});

describe('hasErrorCodePrefix', () => {
  test('matches the code of an Exception or any object, case-sensitively', () => {
    expect(hasErrorCodePrefix(new Exception('Denied', { code: 'AUTH_EXPIRED' }), 'AUTH_')).toBe(
      true,
    );
    expect(hasErrorCodePrefix({ code: 'AUTH_EXPIRED' }, 'AUTH_')).toBe(true);
    expect(hasErrorCodePrefix({ code: 'AUTH_EXPIRED' }, 'auth_')).toBe(false);
    expect(hasErrorCodePrefix({ code: 'USER_NOT_FOUND' }, 'AUTH_')).toBe(false);
  });

  test('matches a string error as the code itself', () => {
    expect(hasErrorCodePrefix('AUTH_EXPIRED', 'AUTH_')).toBe(true);
    expect(hasErrorCodePrefix('USER_NOT_FOUND', 'AUTH_')).toBe(false);
  });

  test('does not match an empty prefix, a number, or an error without a code', () => {
    expect(hasErrorCodePrefix({ code: 'AUTH_EXPIRED' }, '')).toBe(false);
    expect(hasErrorCodePrefix(404, '4')).toBe(false);
    expect(hasErrorCodePrefix(new Error('AUTH_EXPIRED'), 'AUTH_')).toBe(false);
    expect(hasErrorCodePrefix(null, 'AUTH_')).toBe(false);
  });
});

describe('hasErrorCode', () => {
  test('matches the code of an Exception, a system error, or any object', () => {
    expect(hasErrorCode(new Exception('Not found', { code: 'NOT_FOUND' }), 'NOT_FOUND')).toBe(true);
    expect(hasErrorCode(Object.assign(new Error('Missing'), { code: 'ENOENT' }), 'ENOENT')).toBe(
      true,
    );
    expect(hasErrorCode({ code: 'NOT_FOUND' }, 'NOT_FOUND')).toBe(true);
  });

  test('matches a string error as the code itself', () => {
    expect(hasErrorCode('NOT_FOUND', 'NOT_FOUND')).toBe(true);
    expect(hasErrorCode('NOT_FOUND', 'NOT')).toBe(false);
  });

  test('does not match a different code, a code of another type, or no code', () => {
    expect(hasErrorCode({ code: 'NOT_FOUND' }, 'not_found')).toBe(false);
    expect(hasErrorCode({ code: 404 }, '404')).toBe(false);
    expect(hasErrorCode(404, '404')).toBe(false);
    expect(hasErrorCode(new Error('NOT_FOUND'), 'NOT_FOUND')).toBe(false);
    expect(hasErrorCode(null, 'NOT_FOUND')).toBe(false);
    expect(hasErrorCode(undefined, 'NOT_FOUND')).toBe(false);
  });

  test('never matches an empty code', () => {
    expect(hasErrorCode('', '')).toBe(false);
    expect(hasErrorCode({ code: '' }, '')).toBe(false);
  });
});
