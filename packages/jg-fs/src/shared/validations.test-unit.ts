import { describe, expect, test } from 'vitest';

import { ERRORS } from './errors.js';
import {
  isBusyRenameError,
  isMissingPathError,
  isNoFollowError,
  isNotFoundError,
  nonExistentDirectory,
  nonExistentFile,
} from './validations.js';

// an error the way Node.js's filesystem reports one
const systemError = (code: string): Error => Object.assign(new Error(code), { code });

describe('isNoFollowError', () => {
  test.each(['ELOOP', 'EMLINK'])('recognises %s', (code) => {
    expect(isNoFollowError(systemError(code))).toBe(true);
  });

  test.each([
    ['a missing path, which is no link', systemError('ENOENT')],
    ['another code', systemError('EACCES')],
    ['an error without a code', new Error('ENOENT')],
    ['a value that is not an error', { code: 'ENOENT' }],
  ])('rejects %s', (_, error) => {
    expect(isNoFollowError(error)).toBe(false);
  });
});

describe('isBusyRenameError', () => {
  test.each(['EACCES', 'EBUSY', 'EPERM'])('recognises %s on Windows', (code) => {
    expect(isBusyRenameError(systemError(code), 'win32')).toBe(true);
  });

  test('rejects other codes, other platforms, and values that are not errors', () => {
    expect(isBusyRenameError(systemError('ENOENT'), 'win32')).toBe(false);
    expect(isBusyRenameError(systemError('EBUSY'), 'linux')).toBe(false);
    expect(isBusyRenameError({ code: 'EBUSY' }, 'win32')).toBe(false);
    expect(isBusyRenameError(new Error('EBUSY'), 'win32')).toBe(false);
    // the current platform by default, which runs these tests on Linux or macOS
    expect(isBusyRenameError(systemError('EBUSY'))).toBe(process.platform === 'win32');
  });
});

describe('isNotFoundError', () => {
  test('recognises ENOENT only, on errors only', () => {
    expect(isNotFoundError(systemError('ENOENT'))).toBe(true);
    expect(isNotFoundError(systemError('EACCES'))).toBe(false);
    expect(isNotFoundError({ code: 'ENOENT' })).toBe(false);
  });
});

describe('isMissingPathError', () => {
  test.each(['ENOENT', 'ENOTDIR'])('recognises %s', (code) => {
    expect(isMissingPathError(systemError(code))).toBe(true);
  });

  test.each([
    ['another code', systemError('EACCES')],
    ['an error without a code', new Error('ENOTDIR')],
    ['a value that is not an error', { code: 'ENOTDIR' }],
  ])('rejects %s', (_, error) => {
    expect(isMissingPathError(error)).toBe(false);
  });
});

describe.each([
  ['nonExistentFile', nonExistentFile, ERRORS.NON_EXISTENT_FILE, 'file'],
  ['nonExistentDirectory', nonExistentDirectory, ERRORS.NON_EXISTENT_DIRECTORY, 'directory'],
])('%s', (_, build, code, kind) => {
  test('names the path in its message and data, and keeps the error that showed it missing', () => {
    const cause = systemError('ENOENT');

    const error = build('/srv/app/missing', cause);

    expect(error).toMatchObject({
      code,
      message: `The ${kind} '/srv/app/missing' does not exist.`,
      data: { path: '/srv/app/missing' },
    });
    expect(error.cause).toBe(cause);
  });

  test('has no cause when none is given', () => {
    expect('cause' in build('/srv/app/missing')).toBe(false);
  });
});
