import { describe, test, expect } from 'vitest';
import { CODE_WRAPPER, DEFAULT_CODE } from '../shared/constants.js';
import { unwrapCode, wrapCode } from './index.js';

/* ************************************************************************************************
 *                                             TESTS                                              *
 ************************************************************************************************ */

describe('wrapCode', () => {
  test('can wrap a code in number format', () => {
    expect(wrapCode(0)).toBe(`${CODE_WRAPPER.prefix}0${CODE_WRAPPER.suffix}`);
    expect(wrapCode(123)).toBe(`${CODE_WRAPPER.prefix}123${CODE_WRAPPER.suffix}`);
  });

  test('can wrap a code in string format', () => {
    expect(wrapCode('UNKNOWN_ERROR')).toBe(
      `${CODE_WRAPPER.prefix}UNKNOWN_ERROR${CODE_WRAPPER.suffix}`,
    );
  });

  test('if an invalid code is provided, it wraps the default code', () => {
    // @ts-expect-error: calls it the way untyped JavaScript callers can
    expect(wrapCode()).toBe(`${CODE_WRAPPER.prefix}-1${CODE_WRAPPER.suffix}`);
    // @ts-expect-error: calls it the way untyped JavaScript callers can
    expect(wrapCode(undefined)).toBe(`${CODE_WRAPPER.prefix}-1${CODE_WRAPPER.suffix}`);
    // @ts-expect-error: calls it the way untyped JavaScript callers can
    expect(wrapCode(null)).toBe(`${CODE_WRAPPER.prefix}-1${CODE_WRAPPER.suffix}`);
  });
});

describe('unwrapCode', () => {
  test('can unwrap the code from a basic encoded error message', () => {
    expect(unwrapCode(`Some random error${wrapCode(1)}`)).toStrictEqual({
      code: '1',
      startsAt: 17,
    });
    expect(unwrapCode(`Some random error${wrapCode('INVALID_INPUT')}`)).toStrictEqual({
      code: 'INVALID_INPUT',
      startsAt: 17,
    });
    expect(
      unwrapCode(`There has been an error when processing the request.${wrapCode(65451)}`),
    ).toStrictEqual({
      code: '65451',
      startsAt: 52,
    });
    expect(
      unwrapCode(
        `There has been an error when processing the request.${wrapCode('INTERNAL_DB_ERROR')}`,
      ),
    ).toStrictEqual({
      code: 'INTERNAL_DB_ERROR',
      startsAt: 52,
    });
  });

  test('returns -1 if there is no code to unwrap', () => {
    expect(unwrapCode('Some random error.')).toStrictEqual({
      code: DEFAULT_CODE,
      startsAt: -1,
    });
    expect(unwrapCode(JSON.stringify({ code: 'INVALID_INPUT' }))).toStrictEqual({
      code: DEFAULT_CODE,
      startsAt: -1,
    });
  });

  test('for the code to be unwrapped, it must be a the very end of the error message', () => {
    expect(unwrapCode(`Some random error${wrapCode(1)} `)).toStrictEqual({
      code: DEFAULT_CODE,
      startsAt: -1,
    });
    expect(
      unwrapCode(`Some random error${wrapCode('INVALID_INPUT')}. Something else..`),
    ).toStrictEqual({
      code: DEFAULT_CODE,
      startsAt: -1,
    });
  });

  test('can unwrap the code even if there appears to be another error code encoded in the message', () => {
    expect(unwrapCode(`Some random${wrapCode(1)} error${wrapCode('INVALID_INPUT')}`)).toStrictEqual(
      {
        code: 'INVALID_INPUT',
        startsAt: 22,
      },
    );
    expect(
      unwrapCode(`Some random${CODE_WRAPPER.prefix} error${wrapCode('INVALID_INPUT')}`),
    ).toStrictEqual({
      code: 'INVALID_INPUT',
      startsAt: 19,
    });
    expect(
      unwrapCode(`Some random${CODE_WRAPPER.suffix} error${wrapCode('INVALID_INPUT')}`),
    ).toStrictEqual({
      code: 'INVALID_INPUT',
      startsAt: 19,
    });
  });
});
