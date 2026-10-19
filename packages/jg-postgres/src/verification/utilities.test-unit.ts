// @vitest-environment node
import { hashValue } from 'jg-crypto';
import { describe, expect, test } from 'vitest';

import { createAdvisoryLockKey } from '../locks/index.js';

import {
  createIssueLockKey,
  hashChallengeCode,
  isChallengeTokenValid,
  isCodeValid,
} from './utilities.js';

// a token of the issued shape: 43 base64url characters
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ-_01234';

describe('hashChallengeCode', () => {
  test('hashes the token length, the token, and the code, as 64 hexadecimal characters', () => {
    const hash = hashChallengeCode(TOKEN, '123456');

    expect(hash).toBe(hashValue(`43:${TOKEN}:123456`));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('keeps a token and code apart from another split of the same text', () => {
    // without the length prefix, both would hash `a:b:c`
    expect(hashChallengeCode('a:b', 'c')).not.toBe(hashChallengeCode('a', 'b:c'));
  });

  test('changes with the token, for the same code', () => {
    expect(hashChallengeCode(TOKEN, '123456')).not.toBe(
      hashChallengeCode(`${TOKEN.slice(0, -1)}5`, '123456'),
    );
  });
});

describe('createIssueLockKey', () => {
  test('is the advisory lock key of the length-prefixed action and the actor', () => {
    expect(createIssueLockKey('42', 'verify-email')).toBe(
      createAdvisoryLockKey('jg-postgres:verification:12:verify-email:42'),
    );
  });

  test('is the same for the same pair, and apart for another split of the same text', () => {
    expect(createIssueLockKey('b', 'a')).toBe(createIssueLockKey('b', 'a'));
    expect(createIssueLockKey('b', 'a:')).not.toBe(createIssueLockKey(':b', 'a'));
    expect(createIssueLockKey('42', 'verify-email')).not.toBe(
      createIssueLockKey('42', 'verify-phone'),
    );
  });
});

describe('shape checks', () => {
  test.each<[unknown, boolean]>([
    [TOKEN, true],
    [TOKEN.slice(1), false],
    [`${TOKEN}a`, false],
    [`${TOKEN.slice(1)}=`, false],
    [`${TOKEN.slice(1)}+`, false],
    [`${TOKEN.slice(1)}é`, false],
    [43, false],
    [undefined, false],
  ])('isChallengeTokenValid(%s) -> %s', (value, expected) => {
    expect(isChallengeTokenValid(value)).toBe(expected);
  });

  test.each<[unknown, number, boolean]>([
    ['123456', 6, true],
    ['0000', 4, true],
    ['12345', 6, false],
    ['1234567', 6, false],
    ['12345a', 6, false],
    ['12 456', 6, false],
    ['１２３４５６', 6, false],
    [123456, 6, false],
  ])('isCodeValid(%s, %d) -> %s', (value, codeLength, expected) => {
    expect(isCodeValid(value, codeLength)).toBe(expected);
  });
});
