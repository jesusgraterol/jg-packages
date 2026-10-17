import { afterEach, describe, vi, test, expect } from 'vitest';
import { z, type ZodType } from 'zod';
import { Exception } from '../exception/index.js';
import { CODE_WRAPPER, DEFAULT_CODE, DEFAULT_MESSAGE } from '../shared/constants.js';
import { wrapCode } from '../utils/index.js';
import {
  extractMessage,
  extractRedactedMessage,
  isDefaultErrorMessage,
  encodeError,
  decodeError,
  isEncodedError,
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

describe('encodeError', () => {
  test('can encode a string error', () => {
    expect(encodeError('This is an error', 1)).toBe('This is an error{(1)}');
    expect(encodeError('This is an error', 'INVALID_INPUT')).toBe(
      'This is an error{(INVALID_INPUT)}',
    );
  });

  test('can encode an error instance', () => {
    expect(encodeError(new Error('This is an error'), 1)).toBe('This is an error{(1)}');
    expect(encodeError(new ReferenceError('This is an error'), 'INVALID_INPUT')).toBe(
      'This is an error{(INVALID_INPUT)}',
    );
  });

  test('can encode an error instance with cause', () => {
    expect(
      encodeError(
        new Error('This is an error', {
          cause: new Error('This is the cause!'),
        }),
        1,
      ),
    ).toBe('This is an error; [CAUSE]: This is the cause!{(1)}');
    expect(
      encodeError(
        new Error('This is an error', {
          cause: new Error('This is the cause!'),
        }),
        'INVALID_INPUT',
      ),
    ).toBe('This is an error; [CAUSE]: This is the cause!{(INVALID_INPUT)}');
  });
});

describe('decodeError', () => {
  test('can decode a basic error', () => {
    expect(decodeError(encodeError('There was an error.', 100))).toStrictEqual({
      message: 'There was an error.',
      code: '100',
      data: null,
    });
    expect(
      decodeError(encodeError(new Error('There was a nasty error.'), 'DB_ERROR')),
    ).toStrictEqual({
      message: 'There was a nasty error.',
      code: 'DB_ERROR',
      data: null,
    });
  });

  test('can decode an error instance with cause', () => {
    const error = new Error('Top level error.', {
      cause: new Error('First nested cause.', {
        cause: new Error('Second nested cause.'),
      }),
    });
    expect(decodeError(encodeError(error, 100))).toStrictEqual({
      message: 'Top level error.; [CAUSE]: First nested cause.; [CAUSE]: Second nested cause.',
      code: '100',
      data: null,
    });
    expect(decodeError(encodeError(error, 'UNKNOWN_AUTH_ERROR'))).toStrictEqual({
      message: 'Top level error.; [CAUSE]: First nested cause.; [CAUSE]: Second nested cause.',
      code: 'UNKNOWN_AUTH_ERROR',
      data: null,
    });
  });

  test('returns DEFAULT_CODE as the code if it is not an encoded error message', () => {
    expect(decodeError('There was an error.')).toStrictEqual({
      message: 'There was an error.',
      code: DEFAULT_CODE,
      data: null,
    });
    expect(decodeError('There was an error{(100)}.')).toStrictEqual({
      message: 'There was an error{(100)}.',
      code: DEFAULT_CODE,
      data: null,
    });
    expect(decodeError('There was an error{()}')).toStrictEqual({
      message: 'There was an error{()}',
      code: DEFAULT_CODE,
      data: null,
    });
    expect(decodeError(encodeError('There was an error.', DEFAULT_CODE))).toStrictEqual({
      message: 'There was an error.',
      code: DEFAULT_CODE,
      data: null,
    });
  });

  test('can decode object and Error instances that carry a code', () => {
    const decodedData = {
      requestId: 'request-1',
    };
    const providerData = {
      requestId: 'provider-request',
    };
    const providerError = Object.assign(new Error('Provider request failed.'), {
      code: 'PROVIDER_REQUEST_FAILED',
      data: providerData,
      statusCode: 502,
    });

    expect(
      decodeError({
        code: 'INVALID_INPUT',
        data: decodedData,
        message: 'There was an error.',
      }),
    ).toStrictEqual({
      message: 'There was an error.',
      code: 'INVALID_INPUT',
      data: decodedData,
    });
    expect(decodeError(providerError)).toStrictEqual({
      message: 'Provider request failed.',
      code: 'PROVIDER_REQUEST_FAILED',
      data: providerData,
    });
  });

  test('prefers the encoded message code over an object-carried code', () => {
    const decodedData = {
      requestId: 'request-1',
    };

    expect(
      decodeError({
        code: 'OUTER_CODE',
        data: decodedData,
        message: encodeError('There was an error.', 'INNER_CODE'),
      }),
    ).toStrictEqual({
      message: 'There was an error.',
      code: 'INNER_CODE',
      data: decodedData,
    });
  });

  test.each([
    ['false', false],
    ['zero', 0],
    ['empty string', ''],
    ['undefined', undefined],
  ])('can decode %s data from object errors', (_, decodedData) => {
    expect(
      decodeError({
        code: 'FEATURE_DISABLED',
        data: decodedData,
        message: 'feature disabled',
      }),
    ).toStrictEqual({
      message: 'feature disabled',
      code: 'FEATURE_DISABLED',
      data: decodedData,
    });
  });

  test('can decode Exception instances and preserve their resolved code', () => {
    const exceptionData = {
      requestId: 'request-1',
    };
    const sourceException = new Exception('There was an error.', 'SOURCE_CODE', exceptionData);
    const wrappedException = new Exception(sourceException);

    expect(decodeError(sourceException)).toStrictEqual({
      message: 'There was an error.',
      code: 'SOURCE_CODE',
      data: exceptionData,
    });
    expect(decodeError(wrappedException)).toStrictEqual({
      message: 'There was an error.',
      code: 'SOURCE_CODE',
      data: exceptionData,
    });
  });

  test('can decode the correct error code even if there appear to be multiple', () => {
    expect(
      decodeError(
        encodeError(
          `This is an error within an ${encodeError('This is a nested error', 'INVALID')}`,
          'CORRECT_ERROR',
        ),
      ),
    ).toStrictEqual({
      message: `This is an error within an This is a nested error${wrapCode('INVALID')}`,
      code: 'CORRECT_ERROR',
      data: null,
    });
    expect(
      decodeError(
        encodeError(`This is an error within a nested ${CODE_WRAPPER.prefix}`, 'CORRECT_ERROR'),
      ),
    ).toStrictEqual({
      message: `This is an error within a nested ${CODE_WRAPPER.prefix}`,
      code: 'CORRECT_ERROR',
      data: null,
    });
    expect(
      decodeError(
        encodeError(`This is an error within a nested ${CODE_WRAPPER.suffix}`, 'CORRECT_ERROR'),
      ),
    ).toStrictEqual({
      message: `This is an error within a nested ${CODE_WRAPPER.suffix}`,
      code: 'CORRECT_ERROR',
      data: null,
    });
    expect(
      decodeError(
        encodeError(
          `This is an error ${CODE_WRAPPER.prefix}within a nested${CODE_WRAPPER.suffix}`,
          123456,
        ),
      ),
    ).toStrictEqual({
      message: `This is an error ${CODE_WRAPPER.prefix}within a nested${CODE_WRAPPER.suffix}`,
      code: '123456',
      data: null,
    });
  });
});

describe('isEncodedError', () => {
  test('can identify an encoded error from a string', () => {
    expect(isEncodedError(encodeError('There was an error.', 100))).toBe(true);
    expect(isEncodedError('There was an error.')).toBe(false);
    expect(isEncodedError(encodeError('There was an error.', DEFAULT_CODE))).toBe(false);
  });

  test('can identify an encoded error from an error instance', () => {
    expect(isEncodedError(new Error(encodeError('There was an error.', 100)))).toBe(true);
    expect(isEncodedError(new Error('There was an error.'))).toBe(false);
  });
});

describe('getErrorCode', () => {
  test('returns the decoded code from encoded errors', () => {
    const encodedErrorMessage = encodeError('There was an error.', 'INVALID_INPUT');

    expect(getErrorCode(encodedErrorMessage)).toBe('INVALID_INPUT');
    expect(getErrorCode(new Error(encodedErrorMessage))).toBe('INVALID_INPUT');
    expect(getErrorCode({ message: encodedErrorMessage })).toBe('INVALID_INPUT');
    expect(getErrorCode(encodeError('There was an error.', 100))).toBe('100');
    expect(getErrorCode(encodeError('There was an error.', 0))).toBe('0');
  });

  test('returns object-carried codes when the message is not encoded', () => {
    expect(getErrorCode({ code: 'INVALID_INPUT', message: 'There was an error.' })).toBe(
      'INVALID_INPUT',
    );
    expect(getErrorCode({ code: 100, message: 'There was an error.' })).toBe('100');
    expect(getErrorCode({ code: '0', message: 'There was an error.' })).toBe('0');
    expect(getErrorCode({ code: 0, message: 'There was an error.' })).toBe('0');
  });

  test('prefers encoded message codes over object-carried codes', () => {
    expect(
      getErrorCode({
        code: 'OUTER_CODE',
        message: encodeError('There was an error.', 'INNER_CODE'),
      }),
    ).toBe('INNER_CODE');
  });

  test('returns the resolved code from Exception instances', () => {
    const sourceException = new Exception('There was an error.', 'INVALID_INPUT');
    const wrappedException = new Exception(sourceException);

    expect(getErrorCode(sourceException)).toBe('INVALID_INPUT');
    expect(getErrorCode(wrappedException)).toBe('INVALID_INPUT');
    expect(getErrorCode(new Exception(encodeError('There was an error.', 100)))).toBe('100');
  });

  test('returns null when no non-default code can be resolved', () => {
    expect(getErrorCode(null)).toBeNull();
    expect(getErrorCode(undefined)).toBeNull();
    expect(getErrorCode('There was an error.')).toBeNull();
    expect(getErrorCode(new Error('There was an error.'))).toBeNull();
    expect(getErrorCode({ message: 'There was an error.' })).toBeNull();
    expect(getErrorCode({ code: null, message: 'There was an error.' })).toBeNull();
    expect(getErrorCode(encodeError('There was an error.', DEFAULT_CODE))).toBeNull();
    expect(getErrorCode(new Exception('There was an error.'))).toBeNull();
  });
});

describe('hasErrorCodePrefix', () => {
  test('matches raw string codes using case-sensitive prefix comparison', () => {
    expect(hasErrorCodePrefix('INVALID_INPUT', 'INVALID_')).toBe(true);
    expect(hasErrorCodePrefix('INVALID_INPUT', 'INVALID_INPUT')).toBe(true);
    expect(hasErrorCodePrefix('INVALID_INPUT', 'invalid_')).toBe(false);
    expect(hasErrorCodePrefix('INVALID_INPUT', 'OTHER_')).toBe(false);
  });

  test('matches object-carried string codes', () => {
    expect(hasErrorCodePrefix({ code: 'INVALID_INPUT' }, 'INVALID_')).toBe(true);
    expect(hasErrorCodePrefix({ code: 'OTHER_CODE' }, 'INVALID_')).toBe(false);
  });

  test('matches encoded errors from supported error shapes', () => {
    const encodedErrorMessage = encodeError('There was an error.', 'INVALID_INPUT');

    expect(hasErrorCodePrefix(encodedErrorMessage, 'INVALID_')).toBe(true);
    expect(hasErrorCodePrefix(new Error(encodedErrorMessage), 'INVALID_')).toBe(true);
    expect(hasErrorCodePrefix({ message: encodedErrorMessage }, 'INVALID_')).toBe(true);
    expect(hasErrorCodePrefix({ error: encodedErrorMessage }, 'INVALID_')).toBe(true);
  });

  test('matches Exception instances by their resolved string code', () => {
    const sourceException = new Exception('There was an error.', 'INVALID_INPUT');
    const wrappedException = new Exception(sourceException);

    expect(hasErrorCodePrefix(sourceException, 'INVALID_')).toBe(true);
    expect(hasErrorCodePrefix(wrappedException, 'INVALID_')).toBe(true);
  });

  test('matches numeric codes by their decoded string form', () => {
    expect(hasErrorCodePrefix({ code: 100 }, '1')).toBe(true);
    expect(hasErrorCodePrefix(encodeError('There was an error.', 100), '1')).toBe(true);
    expect(hasErrorCodePrefix({ code: 100 }, '2')).toBe(false);
  });

  test('does not match empty prefixes, raw numbers, or unresolved errors', () => {
    expect(hasErrorCodePrefix('INVALID_INPUT', '')).toBe(false);
    expect(hasErrorCodePrefix(100, '1')).toBe(false);
    expect(hasErrorCodePrefix(null, 'INVALID_')).toBe(false);
    expect(hasErrorCodePrefix(undefined, 'INVALID_')).toBe(false);
    expect(hasErrorCodePrefix({}, 'INVALID_')).toBe(false);
    expect(hasErrorCodePrefix(new Error('There was an error.'), 'INVALID_')).toBe(false);
  });
});

describe('hasErrorCode', () => {
  test('matches raw error code values, comparing them as strings', () => {
    expect(hasErrorCode('INVALID_INPUT', 'INVALID_INPUT')).toBe(true);
    expect(hasErrorCode(100, 100)).toBe(true);
    expect(hasErrorCode(0, 0)).toBe(true);
    expect(hasErrorCode('100', 100)).toBe(true);
    expect(hasErrorCode(100, '100')).toBe(true);
    expect(hasErrorCode('100', '1000')).toBe(false);
  });

  test('matches object errors that expose the provided code', () => {
    expect(hasErrorCode({ code: 'INVALID_INPUT' }, 'INVALID_INPUT')).toBe(true);
    expect(hasErrorCode({ code: 100 }, 100)).toBe(true);
    expect(hasErrorCode({ code: '100' }, 100)).toBe(true);
    expect(hasErrorCode({ code: 100 }, '100')).toBe(true);
    expect(hasErrorCode({ code: 'OTHER_CODE' }, 'INVALID_INPUT')).toBe(false);
  });

  test('matches encoded errors from supported error shapes', () => {
    const encodedErrorMessage = encodeError('There was an error.', 'INVALID_INPUT');

    expect(hasErrorCode(encodedErrorMessage, 'INVALID_INPUT')).toBe(true);
    expect(hasErrorCode(new Error(encodedErrorMessage), 'INVALID_INPUT')).toBe(true);
    expect(hasErrorCode({ message: encodedErrorMessage }, 'INVALID_INPUT')).toBe(true);
    expect(hasErrorCode({ error: encodedErrorMessage }, 'INVALID_INPUT')).toBe(true);
    expect(hasErrorCode(encodedErrorMessage, 'OTHER_CODE')).toBe(false);
  });

  test('matches the decoded code when the object code does not match', () => {
    expect(
      hasErrorCode(
        {
          code: 'OUTER_CODE',
          message: encodeError('There was an error.', 'INNER_CODE'),
        },
        'INNER_CODE',
      ),
    ).toBe(true);
  });

  test('matches Exception instances by their resolved code', () => {
    const sourceException = new Exception('There was an error.', 'INVALID_INPUT');
    const wrappedException = new Exception(sourceException);

    expect(hasErrorCode(sourceException, 'INVALID_INPUT')).toBe(true);
    expect(hasErrorCode(wrappedException, 'INVALID_INPUT')).toBe(true);
    expect(hasErrorCode(new Exception(encodeError('There was an error.', 100)), 100)).toBe(true);
    expect(hasErrorCode(new Exception('There was an error.'), DEFAULT_CODE)).toBe(true);
    expect(hasErrorCode(new Exception('There was an error.', 'INVALID_INPUT'), 'OTHER_CODE')).toBe(
      false,
    );
  });

  test('does not match malformed object-carried codes', () => {
    expect(hasErrorCode({ code: null, message: 'There was an error.' }, 'INVALID_INPUT')).toBe(
      false,
    );
    expect(hasErrorCode({ code: false, message: 'There was an error.' }, 'INVALID_INPUT')).toBe(
      false,
    );
    expect(
      hasErrorCode({ code: ['INVALID_INPUT'], message: 'There was an error.' }, 'INVALID_INPUT'),
    ).toBe(false);
  });

  test('does not match missing, malformed, or different non-default codes', () => {
    expect(hasErrorCode(null, 'INVALID_INPUT')).toBe(false);
    expect(hasErrorCode(undefined, 'INVALID_INPUT')).toBe(false);
    expect(hasErrorCode('', 'INVALID_INPUT')).toBe(false);
    expect(hasErrorCode(false, 'INVALID_INPUT')).toBe(false);
    expect(hasErrorCode({}, 'INVALID_INPUT')).toBe(false);
    expect(hasErrorCode(new Error('There was an error.'), 'INVALID_INPUT')).toBe(false);
    expect(hasErrorCode('There was an error{(INVALID_INPUT)}.', 'INVALID_INPUT')).toBe(false);
  });

  test('uses the decodeError fallback behavior for the default code', () => {
    expect(hasErrorCode(undefined, DEFAULT_CODE)).toBe(true);
    expect(hasErrorCode('', DEFAULT_CODE)).toBe(true);
    expect(hasErrorCode(false, DEFAULT_CODE)).toBe(true);
    expect(hasErrorCode({}, DEFAULT_CODE)).toBe(true);
    expect(hasErrorCode(new Error('There was an error.'), DEFAULT_CODE)).toBe(true);
    expect(hasErrorCode(null, DEFAULT_CODE)).toBe(false);
  });
});
