import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { BigNumber } from '../shared/constants.js';
import type { IBigNumberRoundingModeName } from '../shared/types.js';
import { processValue } from './processing.js';

/*
 * Properties: rounding's invariants, over generated values, decimal places, and rounding modes.
 */

const ROUNDING_MODES: IBigNumberRoundingModeName[] = [
  'ROUND_UP',
  'ROUND_DOWN',
  'ROUND_CEIL',
  'ROUND_FLOOR',
  'ROUND_HALF_UP',
  'ROUND_HALF_DOWN',
  'ROUND_HALF_EVEN',
  'ROUND_HALF_CEIL',
  'ROUND_HALF_FLOOR',
];

// finite values, from tiny fractions to large amounts, as numbers or numeric strings
const value = fc.oneof(
  fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
  fc.integer({ min: -1e9, max: 1e9 }).map((cents) => (cents / 100).toFixed(2)),
);

// rounds a value to a string with the given places and mode
const round = (
  input: number | string,
  decimalPlaces: number,
  roundingMode: IBigNumberRoundingModeName,
): string => processValue(input, { decimalPlaces, roundingMode, type: 'string' });

describe('rounding', () => {
  test('never keeps more decimals than asked, and moves the value by less than one step', () => {
    fc.assert(
      fc.property(
        value,
        fc.integer({ min: 0, max: 12 }),
        fc.constantFrom(...ROUNDING_MODES),
        (input, decimalPlaces, roundingMode) => {
          const rounded = new BigNumber(round(input, decimalPlaces, roundingMode));

          expect(rounded.decimalPlaces() ?? 0).toBeLessThanOrEqual(decimalPlaces);
          expect(rounded.minus(input).abs().isLessThan(new BigNumber(10).pow(-decimalPlaces))).toBe(
            true,
          );
        },
      ),
    );
  });

  test('puts the value between its floor and its ceiling', () => {
    fc.assert(
      fc.property(value, fc.integer({ min: 0, max: 12 }), (input, decimalPlaces) => {
        const floor = new BigNumber(round(input, decimalPlaces, 'ROUND_FLOOR'));
        const ceiling = new BigNumber(round(input, decimalPlaces, 'ROUND_CEIL'));

        expect(floor.isLessThanOrEqualTo(input)).toBe(true);
        expect(ceiling.isGreaterThanOrEqualTo(input)).toBe(true);
      }),
    );
  });

  test('leaves a value that already fits unchanged, in every mode', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1e9, max: 1e9 }),
        fc.integer({ min: 2, max: 8 }),
        fc.constantFrom(...ROUNDING_MODES),
        (cents, decimalPlaces, roundingMode) => {
          const input = (cents / 100).toFixed(2);

          expect(new BigNumber(round(input, decimalPlaces, roundingMode)).isEqualTo(input)).toBe(
            true,
          );
        },
      ),
    );
  });
});
