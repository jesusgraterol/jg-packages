// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IUUIDVersion } from '../shared/types.js';
import { isIntegerValid, isUUIDValid } from '../validations/index.js';

import {
  generateRandomFloat,
  generateRandomInteger,
  generateRandomString,
  generateUUID,
} from './generators.js';

describe('Generators', () => {
  describe('generateUUID', () => {
    test.each(<Array<[IUUIDVersion]>>[
      [4],
      [4],
      [4],
      [4],
      [4],
      [4],
      [4],
      [4],
      [4],
      [4],
      [7],
      [7],
      [7],
      [7],
      [7],
      [7],
      [7],
      [7],
      [7],
      [7],
    ])('generateUUID(%i) -> valid UUID', (version) => {
      const uuid = generateUUID(version);
      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBe(36);
      expect(isUUIDValid(uuid, version)).toBe(true);
      expect(
        /^[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}$/.test(uuid),
      ).toBe(true);
    });
  });

  describe('generateRandomString', () => {
    test.each(<Array<[number]>>[[5], [15], [35], [75], [100]])(
      'generateRandomString(%i) -> valid string',
      (length) => {
        const str = generateRandomString(length);
        expect(new RegExp(`^[A-Za-z0-9]{${length}}$`).test(str)).toBe(true);
      },
    );

    test('can generate a random string out a custom list of characters', () => {
      expect(/^[ABCDEFG]{100}$/.test(generateRandomString(100, 'ABCDEFG'))).toBe(true);
      expect(/^[0-9]{100}$/.test(generateRandomString(100, '0123456789'))).toBe(true);
    });
  });

  describe('generateRandomFloat', () => {
    test.each([
      [1, 10],
      [100, 1000],
      [-100, 10000],
      [76, 9885],
      [-5112, -11],
    ])('generateRandomFloat(%d, %d)', (min, max) => {
      const val = generateRandomFloat(min, max);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
    });
  });

  describe('generateRandomInteger', () => {
    test.each([
      [1, 10],
      [100, 1000],
      [-100, 10000],
      [76, 9885],
      [-5112, -11],
    ])('generateRandomInteger(%d, %d)', (min, max) => {
      const val = generateRandomInteger(min, max);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
      expect(isIntegerValid(val)).toBe(true);
    });
  });
});
