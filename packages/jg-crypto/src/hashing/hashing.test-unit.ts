// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS, type IHashAlgorithm } from '../shared/index.js';

import { hashValue } from './hashing.js';

describe('hashValue', () => {
  // the FIPS 180-2 vectors for 'abc' and the empty string
  test.each([
    ['abc', 'sha256', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['', 'sha256', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    [
      'abc',
      'sha384',
      'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
    ],
    [
      '',
      'sha384',
      '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b',
    ],
    [
      'abc',
      'sha512',
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    ],
    [
      '',
      'sha512',
      'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
    ],
  ] satisfies [string, IHashAlgorithm, string][])(
    'hashValue(%j, %s) -> %s',
    (value, algorithm, expected) => {
      expect(hashValue(value, algorithm)).toBe(expected);
    },
  );

  test('uses SHA-256 by default', () => {
    expect(hashValue('abc')).toBe(hashValue('abc', 'sha256'));
  });

  test('hashes a string as its UTF-8 bytes', () => {
    const value = 'café ☕';

    expect(hashValue(value)).toBe(hashValue(new TextEncoder().encode(value)));
  });

  test.each(['md5', 'sha1', 'SHA256', ''])('rejects the algorithm %j', (algorithm) => {
    expectToThrowCode(
      () => hashValue('abc', algorithm as IHashAlgorithm),
      ERRORS.UNSUPPORTED_HASH_ALGORITHM,
      'The hash algorithm must be sha256, sha384, or sha512.',
    );
  });
});
