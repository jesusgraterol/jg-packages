import { describe, expect, test } from 'vitest';

import { encodeError, extractMessage } from '../error-handler/index.js';
import { DEFAULT_CODE, DEFAULT_MESSAGE } from '../shared/constants.js';
import { Exception } from './exception.js';

describe('Exception', () => {
  test('creates an instance of Exception with the provided message and code', () => {
    const exception = new Exception('An error occurred', 'ERROR_CODE');
    expect(exception).toBeInstanceOf(Error);
    expect(exception).toBeInstanceOf(Exception);
    expect(exception).not.toBeInstanceOf(SyntaxError);
    expect(exception.message).toBe('An error occurred');
    expect(exception.code).toBe('ERROR_CODE');
  });

  test('defaults to the default code when no code is provided', () => {
    const exception = new Exception('An error occurred');
    expect(exception.code).toBe(DEFAULT_CODE);
  });

  test('can be instantiated with an encoded error message and code', () => {
    const encodedMessage = encodeError('An error occurred', 'ERROR_CODE');
    const exception = new Exception(encodedMessage);
    expect(exception.message).toBe('An error occurred');
    expect(exception.code).toBe('ERROR_CODE');
    expect(exception.toString()).toBe(encodedMessage);
  });

  test('can be instantiated with an encoded error message in Error instance', () => {
    const encodedMessage = encodeError('An error occurred', 'ERROR_CODE');
    const exception = new Exception(new Error(encodedMessage));
    expect(exception.message).toBe('An error occurred');
    expect(exception.code).toBe('ERROR_CODE');
    expect(exception.toString()).toBe(encodedMessage);
  });

  test('can be instantiated from another Exception instance', () => {
    const originalExceptionData = {
      requestId: 'request-1',
    };
    const originalException = new Exception(
      'request failed',
      'REQUEST_FAILED',
      originalExceptionData,
    );
    const exception = new Exception(originalException);

    expect(exception).toBeInstanceOf(Exception);
    expect(exception).not.toBe(originalException);
    expect(exception.message).toBe('request failed');
    expect(exception.code).toBe('REQUEST_FAILED');
    expect(exception.data).toStrictEqual(originalExceptionData);
    expect(exception.toString()).toBe(originalException.toString());
  });

  test('can wrap an Exception instance with an overridden code and data', () => {
    const originalException = new Exception('token expired', 'TOKEN_EXPIRED', {
      tokenId: 'token-1',
    });
    const exceptionData = {
      sessionId: 'session-1',
    };
    const exception = new Exception(originalException, 'SESSION_EXPIRED', exceptionData);

    expect(exception.message).toBe('token expired');
    expect(exception.code).toBe('SESSION_EXPIRED');
    expect(exception.data).toStrictEqual(exceptionData);
    expect(exception.toString()).toBe(encodeError('token expired', 'SESSION_EXPIRED'));
  });

  test('the provided code overrides the decoded code', () => {
    const encodedMessage = encodeError('An error occurred', 'ERROR_CODE');
    const exception = new Exception(new Error(encodedMessage), 'OVERRIDE_CODE');
    expect(exception.message).toBe('An error occurred');
    expect(exception.code).toBe('OVERRIDE_CODE');
    expect(exception.toString()).toBe(encodeError('An error occurred', 'OVERRIDE_CODE'));
  });

  test('extends Error and preserves the extracted message, name, and code', () => {
    const originalError = new Error('request failed');
    const exception = new Exception(originalError, 'OPENAI_REQUEST_FAILED');

    expect(exception).toBeInstanceOf(Error);
    expect(exception).toBeInstanceOf(Exception);
    expect(exception.name).toBe('Exception');
    expect(exception.message).toBe('request failed');
    expect(exception.code).toBe('OPENAI_REQUEST_FAILED');
    expect(exception.cause).toBeUndefined();
  });

  test('extracts the message from non-Error values', () => {
    const exception = new Exception(
      { reason: { message: 'response payload is invalid' } },
      'INVALID_RESPONSE_DATA',
    );

    expect(exception.message).toBe('response payload is invalid');
    expect(exception.code).toBe('INVALID_RESPONSE_DATA');
  });

  test('uses an object-carried code when no encoded code exists', () => {
    const exceptionData = {
      requestId: 'request-1',
    };
    const exception = new Exception({
      code: 'PROVIDER_REQUEST_FAILED',
      data: exceptionData,
      message: 'provider request failed',
      provider: 'example-provider',
    });

    expect(exception.message).toBe('provider request failed');
    expect(exception.code).toBe('PROVIDER_REQUEST_FAILED');
    expect(exception.data).toStrictEqual(exceptionData);
  });

  test('uses an Error-carried code when no encoded code exists', () => {
    const exceptionData = {
      requestId: 'request-1',
    };
    const providerError = Object.assign(new Error('provider request failed'), {
      code: 'PROVIDER_REQUEST_FAILED',
      data: exceptionData,
      statusCode: 502,
    });
    const exception = new Exception(providerError);

    expect(exception.message).toBe('provider request failed');
    expect(exception.code).toBe('PROVIDER_REQUEST_FAILED');
    expect(exception.data).toStrictEqual(exceptionData);
  });

  test('prefers the encoded message code over an object-carried code', () => {
    const exception = new Exception({
      code: 'OUTER_CODE',
      message: encodeError('request failed', 'INNER_CODE'),
    });

    expect(exception.message).toBe('request failed');
    expect(exception.code).toBe('INNER_CODE');
  });

  test('ignores malformed object-carried codes', () => {
    const exception = new Exception({
      code: null,
      message: 'request failed',
    });

    expect(exception.message).toBe('request failed');
    expect(exception.code).toBe(DEFAULT_CODE);
  });

  test('uses default values for invalid constructor input', () => {
    const exception = new Exception(undefined);

    expect(exception.message).toBe(DEFAULT_MESSAGE);
    expect(exception.code).toBe(DEFAULT_CODE);
    expect(exception.data).toBeNull();
    expect(exception.toRecord()).toStrictEqual({
      message: DEFAULT_MESSAGE,
      code: DEFAULT_CODE,
      data: null,
    });
  });

  test('returns the encoded error string from toString()', () => {
    const exception = new Exception('invalid input provided', 'INVALID_INPUT');

    expect(exception.toString()).toBe(encodeError('invalid input provided', 'INVALID_INPUT'));
  });

  test('uses the encoded error string for string coercion', () => {
    const exception = new Exception('unable to parse output', 'FAILED_TO_PARSE_OUTPUT');
    const expectation = encodeError('unable to parse output', 'FAILED_TO_PARSE_OUTPUT');

    expect(String(exception)).toBe(expectation);
    expect(`${exception}`).toBe(expectation);
  });

  test('returns null for non-string primitive coercion hints', () => {
    const exception = new Exception('invalid response type', 'INVALID_RESPONSE_TYPE');

    expect(exception[Symbol.toPrimitive]('number')).toBeNull();
  });

  test('handles errors without a message property gracefully', () => {
    const exception = new Exception({ reason: 'unknown error' }, -1);
    const expectation = encodeError('unknown error', -1);

    expect(exception.message).toBe('unknown error');
    expect(exception.code).toBe('-1');
    expect(String(exception)).toBe(expectation);
  });

  test('stores the provided exception data', () => {
    const exceptionData = {
      requestId: 'request-1',
      retryable: false,
    };
    const exception = new Exception('request failed', 'REQUEST_FAILED', exceptionData);

    expect(exception.data).toStrictEqual(exceptionData);
  });

  test('can store data while using a decoded code', () => {
    const encodedMessage = encodeError('request failed', 'REQUEST_FAILED');
    const exceptionData = {
      requestId: 'request-1',
    };
    const exception = new Exception(encodedMessage, undefined, exceptionData);

    expect(exception.message).toBe('request failed');
    expect(exception.code).toBe('REQUEST_FAILED');
    expect(exception.data).toStrictEqual(exceptionData);
  });

  test('prefers constructor data over decoded data', () => {
    const decodedExceptionData = {
      requestId: 'decoded-request',
    };
    const constructorExceptionData = {
      requestId: 'constructor-request',
    };
    const sourceException = new Exception('request failed', 'REQUEST_FAILED', decodedExceptionData);
    const exception = new Exception(sourceException, undefined, constructorExceptionData);

    expect(exception.message).toBe('request failed');
    expect(exception.code).toBe('REQUEST_FAILED');
    expect(exception.data).toStrictEqual(constructorExceptionData);
  });

  test('preserves explicit null constructor data over decoded data', () => {
    const sourceException = new Exception('request failed', 'REQUEST_FAILED', {
      requestId: 'decoded-request',
    });
    const exception = new Exception(sourceException, undefined, null);

    expect(exception.message).toBe('request failed');
    expect(exception.code).toBe('REQUEST_FAILED');
    expect(exception.data).toBeNull();
  });

  test.each([
    ['false', false],
    ['zero', 0],
    ['empty string', ''],
  ])('uses decoded %s data when constructor data is omitted', (_, decodedExceptionData) => {
    const exception = new Exception({
      code: 'FEATURE_DISABLED',
      data: decodedExceptionData,
      message: 'feature disabled',
    });

    expect(exception.data).toBe(decodedExceptionData);
    expect(exception.toRecord()).toStrictEqual({
      message: 'feature disabled',
      code: 'FEATURE_DISABLED',
      data: decodedExceptionData,
    });
  });

  test('converts the exception to a record', () => {
    const exceptionData = {
      requestId: 'request-1',
      statusCode: 503,
    };
    const exception = new Exception('service unavailable', 'SERVICE_UNAVAILABLE', exceptionData);

    expect(exception.toRecord()).toStrictEqual({
      message: 'service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      data: exceptionData,
    });
  });

  test('uses null data in the record when no exception data is provided', () => {
    const exception = new Exception('service unavailable', 'SERVICE_UNAVAILABLE');

    expect(exception.data).toBeNull();
    expect(exception.toRecord()).toStrictEqual({
      message: 'service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      data: null,
    });
  });

  test.each([
    ['false', false],
    ['zero', 0],
    ['empty string', ''],
  ])('preserves %s exception data in the record', (_, exceptionData) => {
    const exception = new Exception('feature disabled', 'FEATURE_DISABLED', exceptionData);

    expect(exception.toRecord()).toStrictEqual({
      message: 'feature disabled',
      code: 'FEATURE_DISABLED',
      data: exceptionData,
    });
  });

  test('handles errors with cause property', () => {
    const errorWithCause = new Error('database connection failed', {
      cause: new Error('network timeout'),
    });
    const exception = new Exception(errorWithCause, -1);

    expect(exception.message).toBe('database connection failed; [CAUSE]: network timeout');
    expect(exception.code).toBe('-1');
    expect(exception.toString()).toBe(
      encodeError('database connection failed; [CAUSE]: network timeout', -1),
    );
  });

  test('handles Exception instances nested in an Error cause chain', () => {
    const cause = new Exception('provider request failed', 'PROVIDER_REQUEST_FAILED');
    const errorWithCause = new Error('request failed', { cause });
    const exception = new Exception(errorWithCause, 'REQUEST_FAILED');

    expect(exception.message).toBe('request failed; [CAUSE]: provider request failed');
    expect(exception.code).toBe('REQUEST_FAILED');
    expect(exception.toString()).toBe(
      encodeError('request failed; [CAUSE]: provider request failed', 'REQUEST_FAILED'),
    );
  });

  test('preserves a provided cause using native error options', () => {
    const cause = new Error('network timeout');
    const exceptionData = {
      operation: 'sendReceiptEmail',
    };
    const exception = new Exception(
      'Unable to send the receipt email.',
      'RECEIPT_EMAIL_FAILED',
      exceptionData,
      { cause },
    );

    expect(exception.message).toBe('Unable to send the receipt email.');
    expect(exception.code).toBe('RECEIPT_EMAIL_FAILED');
    expect(exception.data).toStrictEqual(exceptionData);
    expect(exception.cause).toBe(cause);
    expect(extractMessage(exception)).toBe(
      'Unable to send the receipt email.; [CAUSE]: network timeout',
    );
    expect(exception.toString()).toBe(
      encodeError('Unable to send the receipt email.', 'RECEIPT_EMAIL_FAILED'),
    );
    expect(exception.toRecord()).toStrictEqual({
      message: 'Unable to send the receipt email.',
      code: 'RECEIPT_EMAIL_FAILED',
      data: exceptionData,
    });
  });

  test('preserves decoded code and data when error options are provided', () => {
    const decodedExceptionData = {
      requestId: 'request-1',
    };
    const sourceException = new Exception(
      'provider request failed',
      'PROVIDER_REQUEST_FAILED',
      decodedExceptionData,
    );
    const cause = new Error('network timeout');
    const exception = new Exception(sourceException, undefined, undefined, { cause });

    expect(exception.message).toBe('provider request failed');
    expect(exception.code).toBe('PROVIDER_REQUEST_FAILED');
    expect(exception.data).toStrictEqual(decodedExceptionData);
    expect(exception.cause).toBe(cause);
  });

  test.each([
    ['false', false],
    ['zero', 0],
    ['empty string', ''],
    ['null', null],
  ])('preserves %s as cause without appending it to the extracted message', (_, cause) => {
    const exception = new Exception('feature disabled', 'FEATURE_DISABLED', undefined, { cause });

    expect(exception.cause).toBe(cause);
    expect(extractMessage(exception)).toBe('feature disabled');
  });

  test('can init message and code from an error message', () => {
    const exception = new Exception(
      'The format of the provided email is invalid. It must be a valid email address and belong to the organization.{(17,025,551)}',
    );
    expect(exception.message).toBe(
      'The format of the provided email is invalid. It must be a valid email address and belong to the organization.',
    );
    expect(exception.code).toBe('17,025,551');
  });
});
