// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { isPathWithin } from './paths.js';

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
