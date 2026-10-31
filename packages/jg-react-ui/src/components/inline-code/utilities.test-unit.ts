// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { formatRepositoryPath, splitCodeSegments } from './utilities.js';

describe('inline code utilities', () => {
  test.each([
    ['/moldea/x', 'moldea/x'],
    ['moldea/x', 'moldea/x'],
    ['/', ''],
    ['', ''],
    ['//a', '/a'],
  ])('formatRepositoryPath(%s) -> %s', (path, expected) => {
    expect(formatRepositoryPath(path)).toBe(expected);
  });

  test.each([
    ['/src/answer-cache.ts', ['/src/', 'answer-', 'cache.ts']],
    ['archive.tar.gz', ['archive.', 'tar.gz']],
    ['MOLDEA_REFERENCE_MISSING', ['MOLDEA_', 'REFERENCE_', 'MISSING']],
    ['checkEligibility', ['checkEligibility']],
  ])('splitCodeSegments(%s) -> %o', (value, expected) => {
    expect(splitCodeSegments(value)).toStrictEqual(expected);
  });
});
