// @vitest-environment node
import { posix, resolve, win32 } from 'node:path';
import { describe, expect, test } from 'vitest';

import { expectToThrowCode } from 'jg-exception/testing';

import { ERRORS } from './errors.js';
import { isPathWithin, listDirectoriesBelow, listPathAncestry } from './paths.js';

describe('isPathWithin', () => {
  test.each([
    ['/data/app', '/data/app', true],
    ['/data/app', '/data/app/logs/today.log', true],
    ['/data/app', '/data/app/..cache', true],
    ['/data/app', '/data/app/../secrets', false],
    ['/data/app', '/data/application', false],
    ['/data/app', '/data', false],
    ['data/app', 'data/app/file.txt', true],
    ['data/app', './data/app/./file.txt', true],
    ['data/app', 'data/other', false],
  ])('isPathWithin(%s, %s) -> %s', (rootPath, targetPath, expected) => {
    expect(isPathWithin(rootPath, targetPath)).toBe(expected);
  });

  test('compares relative and absolute paths through the working directory', () => {
    expect(isPathWithin('data/app', resolve('data/app/nested/file.txt'))).toBe(true);
  });
});

describe('listPathAncestry', () => {
  test.each([
    ['/srv/app/token', ['/srv', '/srv/app', '/srv/app/token']],
    ['/srv/app/', ['/srv', '/srv/app']],
    ['/srv/app/../other', ['/srv', '/srv/other']],
    ['/', []],
  ])('listPathAncestry(%s) on POSIX -> %o', (path, expected) => {
    expect(listPathAncestry(path, posix)).toStrictEqual(expected);
  });

  test.each([
    [
      'C:\\Users\\RUNNER~1\\token',
      ['C:\\Users', 'C:\\Users\\RUNNER~1', 'C:\\Users\\RUNNER~1\\token'],
    ],
    ['C:/Users/ada/', ['C:\\Users', 'C:\\Users\\ada']],
    [
      '\\\\server\\share\\keys\\token',
      ['\\\\server\\share\\keys', '\\\\server\\share\\keys\\token'],
    ],
    ['C:\\', []],
  ])('listPathAncestry(%s) on Windows -> %o', (path, expected) => {
    expect(listPathAncestry(path, win32)).toStrictEqual(expected);
  });

  test('resolves a relative path through the working directory, with the current system by default', () => {
    expect(listPathAncestry('token').at(-1)).toBe(resolve('token'));
  });
});

describe('listDirectoriesBelow', () => {
  test('lists the directories strictly below the root, down to the parent', () => {
    expect(listDirectoriesBelow('/repo', '/repo/docs/guides/install.md')).toStrictEqual([
      resolve('/repo/docs'),
      resolve('/repo/docs/guides'),
    ]);
    expect(listDirectoriesBelow('/repo', '/repo/README.md')).toStrictEqual([]);
  });

  test.each([
    ['/repo', '/repo'],
    ['/repo', '/elsewhere/file.md'],
    ['/repo', '/repo/../file.md'],
  ])('listDirectoriesBelow(%s, %s) -> throws PATH_OUTSIDE_ROOT', (rootPath, path) => {
    expectToThrowCode(() => listDirectoriesBelow(rootPath, path), ERRORS.PATH_OUTSIDE_ROOT);
  });
});
