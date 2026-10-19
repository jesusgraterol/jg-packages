import { describe, expect, test } from 'vitest';

import { MAX_VALIDATION_ISSUES } from './constants.js';
import { toValidationIssues } from './utilities.js';

describe('toValidationIssues', () => {
  test('writes every path as plain keys, whatever segments the validator used', () => {
    expect(
      toValidationIssues([
        { message: 'Expected a string', path: ['items', 0, 'name'] },
        { message: 'Too short', path: [{ key: 'items' }, { key: 1 }] },
        { message: 'Unknown', path: [Symbol('meta'), { key: Symbol() }] },
        { message: 'Invalid input' },
      ]),
    ).toStrictEqual([
      { path: ['items', 0, 'name'], message: 'Expected a string' },
      { path: ['items', 1], message: 'Too short' },
      { path: ['meta', ''], message: 'Unknown' },
      { path: [], message: 'Invalid input' },
    ]);
  });

  test(`keeps at most ${String(MAX_VALIDATION_ISSUES)} issues`, () => {
    const issues = Array.from({ length: 1000 }, (_, index) => ({
      message: 'Required',
      path: [index],
    }));

    const result = toValidationIssues(issues);

    expect(result).toHaveLength(MAX_VALIDATION_ISSUES);
    expect(result.at(-1)).toStrictEqual({ path: [MAX_VALIDATION_ISSUES - 1], message: 'Required' });
  });
});
