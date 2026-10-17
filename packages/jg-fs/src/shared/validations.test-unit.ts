import { describe, expect, test } from 'vitest';

import { isNoFollowError, isNotFoundError } from './validations.js';

// an error the way Node.js's filesystem reports one
const systemError = (code: string): Error => Object.assign(new Error(code), { code });

describe('isNoFollowError', () => {
  test.each(['ENOENT', 'ELOOP', 'EMLINK'])('recognises %s', (code) => {
    expect(isNoFollowError(systemError(code))).toBe(true);
  });

  test.each([
    ['another code', systemError('EACCES')],
    ['an error without a code', new Error('ENOENT')],
    ['a value that is not an error', { code: 'ENOENT' }],
  ])('rejects %s', (_, error) => {
    expect(isNoFollowError(error)).toBe(false);
  });
});

describe('isNotFoundError', () => {
  test('recognises ENOENT only, on errors only', () => {
    expect(isNotFoundError(systemError('ENOENT'))).toBe(true);
    expect(isNotFoundError(systemError('EACCES'))).toBe(false);
    expect(isNotFoundError({ code: 'ENOENT' })).toBe(false);
  });
});
