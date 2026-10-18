import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { quoteIdentifier } from './identifiers.js';

describe('quoteIdentifier', () => {
  test.each([
    ['sort_order', '"sort_order"'],
    ['order', '"order"'],
    ['Order Items', '"Order Items"'],
    ['say "hi"', '"say ""hi"""'],
    ['a'.repeat(63), `"${'a'.repeat(63)}"`],
  ])('quoteIdentifier(%s) -> %s', (name, expected) => {
    expect(quoteIdentifier(name)).toBe(expected);
  });

  test.each(['', 'nul\0name', 'a'.repeat(64), 'é'.repeat(32)])(
    'quoteIdentifier(%o) -> INVALID_IDENTIFIER',
    (name) => {
      expectToThrowCode(
        () => quoteIdentifier(name),
        ERRORS.INVALID_IDENTIFIER,
        'The identifier is empty, holds a null character, or is longer than 63 bytes.',
      );
    },
  );
});
