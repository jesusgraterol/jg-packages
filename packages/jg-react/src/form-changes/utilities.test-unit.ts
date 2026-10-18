import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import {
  areFormCommandsEqual,
  normalizeFormCommand,
  shouldAdoptConfirmedCommand,
} from './utilities.js';

describe('normalizeFormCommand', () => {
  test('keeps the command as it is without a normalizer', () => {
    const command = { name: ' Ada ' };

    expect(normalizeFormCommand(command, undefined)).toBe(command);
  });

  test('passes the command through the normalizer', () => {
    expect(
      normalizeFormCommand({ name: ' Ada ' }, ({ name }) => ({ name: name.trim() })),
    ).toStrictEqual({ name: 'Ada' });
  });
});

describe('areFormCommandsEqual', () => {
  test('compares by value, whatever the key order, at any depth', () => {
    expect(
      areFormCommandsEqual({ name: 'Ada', tags: ['a', 'b'] }, { tags: ['a', 'b'], name: 'Ada' }),
    ).toBe(true);
    expect(areFormCommandsEqual({ profile: { bio: 'x' } }, { profile: { bio: 'y' } })).toBe(false);
    expect(areFormCommandsEqual({ tags: ['a', 'b'] }, { tags: ['b', 'a'] })).toBe(false);
  });

  test('compares as JSON: a missing key equals an undefined one, and a Map equals {}', () => {
    expect(areFormCommandsEqual({ name: 'Ada', bio: undefined }, { name: 'Ada' })).toBe(true);
    expect(areFormCommandsEqual({ roles: new Map([['a', 1]]) }, { roles: {} })).toBe(true);
  });

  test('throws UNABLE_TO_SERIALIZE_JSON for a command holding a BigInt', () => {
    expectToThrowCode(
      () => areFormCommandsEqual({ amount: 1n }, { amount: 1n }),
      'UNABLE_TO_SERIALIZE_JSON',
    );
  });
});

describe('shouldAdoptConfirmedCommand', () => {
  test('adopts a confirmed command only when it differs by value', () => {
    expect(shouldAdoptConfirmedCommand({ name: 'Ada' }, { name: 'Ada' })).toBe(false);
    expect(shouldAdoptConfirmedCommand({ name: 'Ada' }, { name: 'Grace' })).toBe(true);
  });
});
