import { describe, expect, test } from 'vitest';

import { findAssertedCodes } from './error-codes.ts';

const CODES = new Map([
  ['INVALID_CURSOR', 'INVALID_CURSOR'],
  ['TIMEOUT', 'TIMEOUT'],
  ['STORE_UNAVAILABLE', 'STORE_UNAVAILABLE'],
]);

// the codes a test file's text asserts, sorted
const asserted = (source: string): string[] => [...findAssertedCodes(source, CODES)].sort();

describe('findAssertedCodes', () => {
  test.each([
    ['expectToThrowCode', "expectToThrowCode(() => decodeCursor('%'), ERRORS.INVALID_CURSOR);"],
    ['expectToRejectCode', "await expectToRejectCode(store.set(1, 2), 'STORE_UNAVAILABLE');"],
    ['hasErrorCode', 'expect(hasErrorCode(error, ERRORS.TIMEOUT)).toBe(true);'],
  ])('counts the code argument of %s', (_, source) => {
    expect(asserted(source)).toHaveLength(1);
  });

  test("counts a code or kind property anywhere inside a matcher's arguments", () => {
    expect(
      asserted(
        [
          "expect(error).toMatchObject({ kind: 'TIMEOUT', status: null });",
          'await expect(store.set(1, 2)).rejects.toMatchObject({ code: ERRORS.STORE_UNAVAILABLE });',
          'expect(() => decode()).toThrow(expect.objectContaining({ code: ERRORS.INVALID_CURSOR }));',
        ].join('\n'),
      ),
    ).toStrictEqual(['INVALID_CURSOR', 'STORE_UNAVAILABLE', 'TIMEOUT']);
  });

  test("counts a matcher's argument when expect received an error's code or kind", () => {
    expect(
      asserted(
        "expect(error.code).toBe(ERRORS.TIMEOUT);\nexpect(failure.kind).toBe('INVALID_CURSOR');",
      ),
    ).toStrictEqual(['INVALID_CURSOR', 'TIMEOUT']);
  });

  test.each([
    ['a comment', '// expectToThrowCode(fn, ERRORS.TIMEOUT)\n/* code: ERRORS.TIMEOUT */'],
    ["expect(ERRORS.X).toBe('X')", "expect(ERRORS.TIMEOUT).toBe('TIMEOUT');"],
    ['a constant', 'const expected = ERRORS.TIMEOUT;\nexpectToThrowCode(fn, expected);'],
    ['a test table', "test.each([[ERRORS.TIMEOUT]])('%s', (code) => run(code));"],
    ['a code outside a code property', "expect(error).toMatchObject({ message: 'TIMEOUT' });"],
    ['an unknown key', 'expectToThrowCode(fn, ERRORS.SOMETHING_ELSE);'],
    [
      "the operation's own arguments",
      "expectToThrowCode(() => run('TIMEOUT'), ERRORS.INVALID_CURSOR);",
    ],
  ])("doesn't count %s", (name, source) => {
    expect(asserted(source)).toStrictEqual(
      name === "the operation's own arguments" ? ['INVALID_CURSOR'] : [],
    );
  });
});
