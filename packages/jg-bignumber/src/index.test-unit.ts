import { expectToThrowCode } from 'jg-exception/testing';
import { describe, test, expect } from 'vitest';
import { BigNumber } from './shared/constants.js';
import { ERRORS } from './shared/errors.js';
import type { IBigNumberRoundingModeName, IType } from './shared/types.js';
import {
  getBigNumber,
  prettifyValue,
  processValue,
  isBigNumber,
  isNumber,
  isInteger,
  isFloat,
  calculateSum,
  calculateMin,
  calculateMax,
  calculateMean,
  calculateMedian,
  calculatePercentageChange,
  adjustByPercentage,
  calculatePercentageRepresentation,
  calculateExchange,
  calculateExchangeFee,
  calculateWeightedEntry,
} from './index.js';

/* ************************************************************************************************
 *                                           CONSTANTS                                            *
 ************************************************************************************************ */

// valid and invalid numeric values
const valid = [
  -854.11,
  100.54,
  154124564.655,
  100.0,
  '-4561.551',
  '100.54',
  '9845418.455561',
  '100.00',
  '100.',
  BigNumber(-854.11),
  BigNumber(100.54),
  BigNumber('9845418.455561'),
  BigNumber('-4561.551'),
  0,
  -0,
];
const invalid = [
  Infinity,
  -Infinity,
  '-Infinity',
  {},
  [],
  [1, 2, 3],
  undefined,
  null,
  NaN,
  '',
  new Date(),
  Buffer.from('Hello!'),
  true,
  false,
  Symbol('Hello'),
  Symbol.for('Hello'),
  new Set([1, 2, 3]),
  new Map([
    ['dog', 'woof'],
    ['asd', 'true'],
  ]),
  BigNumber(NaN),
  BigNumber('123,123.11'),
  BigNumber(undefined!),
  BigNumber(null!),
  '00.00.00',
  '123123.1231.555,28',
];

/* ************************************************************************************************
 *                                             TESTS                                              *
 ************************************************************************************************ */

describe('Value Procesors', () => {
  describe('getBigNumber', () => {
    test('keeps the error bignumber.js throws as the cause, when a consumer turns STRICT on', () => {
      BigNumber.config({ STRICT: true });
      try {
        let thrown: unknown;
        try {
          getBigNumber('not a number');
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toMatchObject({ code: ERRORS.INVALID_VALUE });
        expect((thrown as { cause?: unknown }).cause).toBeInstanceOf(Error);
      } finally {
        BigNumber.config({ STRICT: false });
      }
    });

    test('can instantiate BigNumber with any valid value', () => {
      valid.forEach((value) => {
        const bn = getBigNumber(value);
        expect(bn).toBeInstanceOf(BigNumber);
        expect(BigNumber.isBigNumber(bn)).toBe(true);
        expect(bn.toNumber()).toBe(Number(value));
      });
    });

    test('regardless of how BigNumber is instantiated, the value is always identical', () => {
      const fromString = getBigNumber('456452154.5645412');
      const fromNumber = getBigNumber(456452154.5645412);
      const fromBigNumber = getBigNumber(BigNumber(456452154.5645412));

      // ensure they are all instances of BigNumber
      expect(BigNumber.isBigNumber(fromString)).toBe(true);
      expect(BigNumber.isBigNumber(fromNumber)).toBe(true);
      expect(BigNumber.isBigNumber(fromBigNumber)).toBe(true);

      // they should be all equals to one another
      expect(fromString.isEqualTo(fromNumber)).toBe(true);
      expect(fromNumber.isEqualTo(fromBigNumber)).toBe(true);
      expect(fromString.isEqualTo(fromBigNumber)).toBe(true);
    });

    test('can make use of any of the instance methods', () => {
      expect(getBigNumber(1).absoluteValue().toNumber()).toBe(1);
      expect(getBigNumber(-1).absoluteValue().toNumber()).toBe(1);

      expect(getBigNumber(355).dividedBy(113).toString()).toBe('3.14159292035398230088');

      expect(getBigNumber(5).dividedToIntegerBy(3).toString()).toBe('1');

      expect(getBigNumber(0.7).exponentiatedBy(2).toString()).toBe('0.49');

      expect(getBigNumber(-12.7).integerValue().toString()).toBe('-13');

      expect(getBigNumber(1).isEqualTo(1)).toBe(true);

      expect(getBigNumber(1).isFinite()).toBe(true);

      expect(getBigNumber(0.1).isGreaterThan(0.01)).toBe(true);
      expect(getBigNumber(0.1).isGreaterThanOrEqualTo(0.1)).toBe(true);

      expect(getBigNumber(1).isInteger()).toBe(true);
      expect(getBigNumber(0.11).isInteger()).toBe(false);

      expect(getBigNumber(0.11).isLessThan(0.2)).toBe(true);
      expect(getBigNumber(0.11).isLessThanOrEqualTo(0.11)).toBe(true);

      expect(getBigNumber(-1).isNegative()).toBe(true);

      expect(getBigNumber(1).isPositive()).toBe(true);

      expect(getBigNumber(0).isZero()).toBe(true);

      expect(getBigNumber(5).minus(1).toString()).toBe('4');

      expect(getBigNumber(1).modulo(0.9).toString()).toBe('0.1');

      expect(getBigNumber(0.6).multipliedBy(3).toString()).toBe('1.8');

      expect(getBigNumber(0.6).negated().toString()).toBe('-0.6');
      expect(getBigNumber(-0.6).negated().toString()).toBe('0.6');

      expect(getBigNumber(0.1).plus(0.2).toString()).toBe('0.3');

      expect(getBigNumber(1.23).shiftedBy(3).toString()).toBe('1230');
      expect(getBigNumber(1.23).shiftedBy(-3).toString()).toBe('0.00123');

      expect(getBigNumber(16).squareRoot().toString()).toBe('4');

      expect(getBigNumber(45.6).toExponential().toString()).toBe('4.56e+1');

      expect(getBigNumber(1.75).toFraction().toString()).toBe('7,4');
    });

    test('throws if an invalid value is provided', () => {
      invalid.forEach((value) => {
        expectToThrowCode(() => getBigNumber(value as never), ERRORS.INVALID_VALUE);
      });
    });
  });

  describe('processValue', () => {
    test('can process any valid value w/ default config', () => {
      const val = processValue(100.585);
      expect(val).toBeTypeOf('number');
      expect(val).toBe(100.59);
    });

    test('can specify the type for the processing output', () => {
      expect(processValue(110.55, { type: 'number' })).toBe(110.55);
      expect(processValue(110.55, { type: 'string' })).toBe('110.55');
      expect(BigNumber(110.55).isEqualTo(processValue(110.55, { type: 'bignumber' }))).toBe(true);
    });

    test('can specify the number of decimal places for the processing output', () => {
      expect(processValue('512.1111', { decimalPlaces: 2, type: 'string' })).toBe('512.11');
      expect(processValue('512.1111111111111111111', { decimalPlaces: 18, type: 'string' })).toBe(
        '512.111111111111111111',
      );
      expect(processValue('512.855', { decimalPlaces: 2, type: 'string' })).toBe('512.86');
      expect(processValue('512.855', { decimalPlaces: 15, type: 'string' })).toBe('512.855');
    });

    test('can specify the rounding mode for the processing output', () => {
      expect(processValue(512.155, { roundingMode: 'ROUND_HALF_UP' })).toBe(512.16);
      expect(processValue(512.155, { roundingMode: 'ROUND_HALF_DOWN' })).toBe(512.15);
      expect(processValue(512.155, { roundingMode: 'ROUND_CEIL' })).toBe(512.16);
      expect(processValue(512.5551, { roundingMode: 'ROUND_HALF_CEIL' })).toBe(512.56);
      expect(processValue(512.555, { roundingMode: 'ROUND_HALF_CEIL' })).toBe(512.56);
      expect(processValue(512.155, { roundingMode: 'ROUND_FLOOR' })).toBe(512.15);
      expect(processValue(512.515, { roundingMode: 'ROUND_HALF_FLOOR' })).toBe(512.51);
      expect(processValue(512.5151, { roundingMode: 'ROUND_HALF_FLOOR' })).toBe(512.52);
    });

    test('applies the decimal places to every rounding mode, including CEIL and FLOOR', () => {
      expect(processValue(19.991, { roundingMode: 'ROUND_CEIL', decimalPlaces: 2 })).toBe(20);
      expect(processValue(19.001, { roundingMode: 'ROUND_CEIL', decimalPlaces: 2 })).toBe(19.01);
      expect(processValue(-19.001, { roundingMode: 'ROUND_FLOOR', decimalPlaces: 2 })).toBe(-19.01);
      expect(processValue(512.155, { roundingMode: 'ROUND_CEIL', decimalPlaces: 0 })).toBe(513);
      expect(processValue(512.553, { roundingMode: 'ROUND_HALF_CEIL', decimalPlaces: 0 })).toBe(
        513,
      );
      expect(processValue(512.499, { roundingMode: 'ROUND_HALF_CEIL', decimalPlaces: 0 })).toBe(
        512,
      );
      expect(processValue(512.155, { roundingMode: 'ROUND_FLOOR', decimalPlaces: 0 })).toBe(512);
      expect(processValue(512.51, { roundingMode: 'ROUND_HALF_FLOOR', decimalPlaces: 0 })).toBe(
        513,
      );
      expect(processValue(512.5, { roundingMode: 'ROUND_HALF_FLOOR', decimalPlaces: 0 })).toBe(512);
    });

    test.each([[Infinity], [-Infinity], ['Infinity'], [Number.NaN], ['NaN']])(
      'processValue(%s) -> throws INVALID_VALUE, because only finite values are numbers',
      (value) => {
        expectToThrowCode(() => processValue(value), ERRORS.INVALID_VALUE);
      },
    );

    test('throws if an invalid value is provided', () => {
      expectToThrowCode(() => processValue(undefined!), ERRORS.INVALID_VALUE);
    });

    test('throws if an invalid type is provided', () => {
      expectToThrowCode(() => processValue(1, { type: <IType>'invalid' }), ERRORS.INVALID_TYPE);
    });

    test('throws if an invalid rounding mode is provided', () => {
      expectToThrowCode(
        () => processValue(1, { roundingMode: <IBigNumberRoundingModeName>'invalid' }),
        ERRORS.INVALID_ROUNDING_MODE,
      );
    });

    test('throws if an invalid number of decimal places is provided', () => {
      expectToThrowCode(
        () => processValue(1, { decimalPlaces: -5 }),
        ERRORS.INVALID_DECIMAL_PLACES,
      );
    });
  });

  describe('prettifyValue', () => {
    test('throws INVALID_BIGNUMBER_FORMAT, with the cause, for a format bignumber.js rejects', () => {
      expectToThrowCode(
        () => prettifyValue(1234.5, { format: { groupSize: Symbol('size') as unknown as number } }),
        ERRORS.INVALID_BIGNUMBER_FORMAT,
      );
      const cause = new Error('not a string');
      expect(() =>
        prettifyValue(1234.5, {
          format: {
            prefix: {
              toString: () => {
                throw cause;
              },
            } as unknown as string,
          },
        }),
      ).toThrow(expect.objectContaining({ code: ERRORS.INVALID_BIGNUMBER_FORMAT, cause }));
    });

    test('keeps trailing zeros up to minimumDecimalPlaces, and drops them by default', () => {
      expect(prettifyValue(1234.5, { format: { prefix: '$' } })).toBe('$1,234.5');
      expect(prettifyValue(1234.5, { format: { prefix: '$', minimumDecimalPlaces: 2 } })).toBe(
        '$1,234.50',
      );
      expect(prettifyValue(1234, { format: { minimumDecimalPlaces: 2 } })).toBe('1,234.00');
      expect(prettifyValue(-0.5, { format: { minimumDecimalPlaces: 1 } })).toBe('-0.5');
      // the minimum never cuts decimals the value has, up to decimalPlaces
      expect(
        prettifyValue(0.0012, {
          processing: { decimalPlaces: 4 },
          format: { minimumDecimalPlaces: 2 },
        }),
      ).toBe('0.0012');
      expect(
        prettifyValue(12.3456, {
          processing: { decimalPlaces: 0 },
          format: { minimumDecimalPlaces: 0 },
        }),
      ).toBe('12');
    });

    test('throws INVALID_BIGNUMBER_FORMAT for a minimumDecimalPlaces past decimalPlaces or invalid', () => {
      expectToThrowCode(
        () => prettifyValue(1, { format: { minimumDecimalPlaces: 3 } }),
        ERRORS.INVALID_BIGNUMBER_FORMAT,
      );
      expectToThrowCode(
        () => prettifyValue(1, { format: { minimumDecimalPlaces: -1 } }),
        ERRORS.INVALID_BIGNUMBER_FORMAT,
      );
      expectToThrowCode(
        () => prettifyValue(1, { format: { minimumDecimalPlaces: 1.5 } }),
        ERRORS.INVALID_BIGNUMBER_FORMAT,
      );
    });

    test('passes an invalid processing setting through with its own code', () => {
      expectToThrowCode(
        () => prettifyValue(1, { processing: { decimalPlaces: -1 } }),
        ERRORS.INVALID_DECIMAL_PLACES,
      );
    });

    test('can prettify a number with any number of decimals and any rounding mode', () => {
      expect(prettifyValue(1.555, { processing: { roundingMode: 'ROUND_HALF_UP' } })).toBe('1.56');
      expect(prettifyValue(1.555, { processing: { roundingMode: 'ROUND_HALF_DOWN' } })).toBe(
        '1.55',
      );
      expect(
        prettifyValue(105142.821546985, {
          processing: { decimalPlaces: 8, roundingMode: 'ROUND_HALF_DOWN' },
        }),
      ).toBe('105,142.82154698');
    });

    test('can separate groups with any character', () => {
      expect(prettifyValue(15426525.84, { format: { groupSeparator: ' ' } })).toBe('15 426 525.84');
      expect(prettifyValue(15426525.84, { format: { groupSeparator: '-' } })).toBe('15-426-525.84');
    });

    test('can use any character to separate thousands and decimals', () => {
      expect(
        prettifyValue(15426525.84, { format: { groupSeparator: '.', decimalSeparator: ',' } }),
      ).toBe('15.426.525,84');
    });

    test('can add a prefix to any number', () => {
      expect(prettifyValue(15426525.84, { format: { prefix: '$' } })).toBe('$15,426,525.84');
      expect(prettifyValue(15426525.84, { format: { prefix: 'USD ' } })).toBe('USD 15,426,525.84');
      expect(
        prettifyValue(15426525.846545124, {
          processing: { decimalPlaces: 8 },
          format: { prefix: 'BTC ' },
        }),
      ).toBe('BTC 15,426,525.84654512');
      expect(
        prettifyValue('15426525.846545124846545124', {
          processing: { decimalPlaces: 18 },
          format: { prefix: 'ETH ' },
        }),
      ).toBe('ETH 15,426,525.846545124846545124');
    });

    test('can add a suffix to any number', () => {
      expect(prettifyValue(15426525.84, { format: { suffix: '$' } })).toBe('15,426,525.84$');
      expect(prettifyValue(15426525.84, { format: { suffix: ' USD' } })).toBe('15,426,525.84 USD');
      expect(
        prettifyValue(15426525.846545124, {
          processing: { decimalPlaces: 8 },
          format: { suffix: ' BTC' },
        }),
      ).toBe('15,426,525.84654512 BTC');
      expect(
        prettifyValue('15426525.846545124846545124', {
          processing: { decimalPlaces: 18 },
          format: { suffix: ' ETH' },
        }),
      ).toBe('15,426,525.846545124846545124 ETH');
    });
  });
});

describe('Helpers', () => {
  describe('isBigNumber', () => {
    test('can identify when a value is a BigNumber Instance', () => {
      [getBigNumber(1), getBigNumber('123'), getBigNumber(BigNumber(1))].forEach((val) => {
        expect(isBigNumber(val)).toBe(true);
      });
    });

    test('can identify when a value is not a BigNumber Instance', () => {
      [112.55, '1234.55', new Date(), getBigNumber('123').toString()].forEach((val) => {
        expect(isBigNumber(val)).toBe(false);
      });
    });
  });

  describe('isNumber', () => {
    test('can determine if a value is a valid number', () => {
      expect(valid.every(isNumber)).toBe(true);
    });

    test('can determine if a value is an invalid number', () => {
      expect(invalid.every(isNumber)).toBe(false);
    });
  });

  describe('isInteger', () => {
    test('can determine if a value is an integer', () => {
      expect(isInteger(100)).toBe(true);
      expect(isInteger('4541534154')).toBe(true);
      expect(isInteger('1.')).toBe(true);
    });

    test('can determine if a value is not an integer', () => {
      expect(isInteger(undefined)).toBe(false);
      expect(isInteger(100.55)).toBe(false);
      expect(isInteger('1.01')).toBe(false);
    });
  });

  describe('isFloat', () => {
    test('can determine if a value is a float', () => {
      expect(isFloat(100.55)).toBe(true);
      expect(isFloat('4541534154.54641515645644512')).toBe(true);
      expect(isFloat('1.001')).toBe(true);
    });

    test('can determine if a value is not a float', () => {
      expect(isFloat(undefined)).toBe(false);
      expect(isFloat(100)).toBe(false);
      expect(isFloat('1.0')).toBe(false);
    });
  });
});

describe('Essential Calculations', () => {
  describe('calculateSum', () => {
    test('returns 0 if an empty list of values is provided', () => {
      expect(calculateSum([])).toBe(0);
    });

    test('can calculate the sum for any array of values', () => {
      expect(
        calculateSum([
          1,
          86,
          '55',
          46.33,
          '47.55',
          BigNumber(8041.663321),
          485,
          '99.11',
          BigNumber(-800.654),
        ]),
      ).toBe(8061);
      expect(calculateSum([100, 50, 99.11, 68.3])).toBe(317.41);
      expect(
        calculateSum(
          ['0.286304850273819327', '0.00290532', '0.00251940040614675', '0.03506759540691015'],
          { decimalPlaces: 18, type: 'string' },
        ),
      ).toBe('0.326797166086876227');
    });

    test('throws if an invalid array of values is provided', () => {
      expectToThrowCode(() => calculateSum(undefined!), ERRORS.INVALID_VALUES_ARRAY);
      expectToThrowCode(() => calculateSum(null!), ERRORS.INVALID_VALUES_ARRAY);
      // @ts-expect-error: passes what untyped JavaScript callers can
      expectToThrowCode(() => calculateSum({}), ERRORS.INVALID_VALUES_ARRAY);
      // @ts-expect-error: passes what untyped JavaScript callers can
      expectToThrowCode(() => calculateSum(1), ERRORS.INVALID_VALUES_ARRAY);
      // @ts-expect-error: passes what untyped JavaScript callers can
      expectToThrowCode(() => calculateSum('asd'), ERRORS.INVALID_VALUES_ARRAY);
    });

    test('throws if any of the values in the array is invalid', () => {
      expectToThrowCode(
        () =>
          calculateSum([
            1,
            86,
            '55',
            46.33,
            '47.55',
            BigNumber(8041.663321),
            485,
            '99.11',
            BigNumber(-800.654),
            NaN,
          ]),
        ERRORS.INVALID_VALUE,
      );
    });

    test('throws if the decimal places are invalid', () => {
      expectToThrowCode(
        () => calculateSum([1, 86], { decimalPlaces: -1 }),
        ERRORS.INVALID_DECIMAL_PLACES,
      );
    });

    test('throws if the processing output type is invalid', () => {
      expectToThrowCode(
        () => calculateSum([1, 86], { type: <IType>'invalid' }),
        ERRORS.INVALID_TYPE,
      );
    });

    test('throws if the rounding mode is invalid', () => {
      expectToThrowCode(
        () => calculateSum([1, 86], { roundingMode: <IBigNumberRoundingModeName>'invalid' }),
        ERRORS.INVALID_ROUNDING_MODE,
      );
    });
  });

  describe('calculateMin', () => {
    test('returns 0 if an empty list of values is provided', () => {
      expect(calculateMin([])).toBe(0);
    });

    test('can identify the smallest value in an array of ints and floats', () => {
      expect(calculateMin([100, 200, 300, 400, 500])).toBe(100);
      expect(calculateMin([100.54, 201.69, 302.55, 988.25, 631.12])).toBe(100.54);
    });

    test('can identify the smallest value in an array of mixed types', () => {
      expect(
        calculateMin([
          1,
          86,
          '55',
          46.33,
          '47.55',
          BigNumber(8041.663321),
          485,
          '99.11',
          BigNumber(-800.654),
        ]),
      ).toBe(-800.65);
    });
  });

  describe('calculateMax', () => {
    test('returns 0 if an empty list of values is provided', () => {
      expect(calculateMax([])).toBe(0);
    });

    test('can identify the largest value in an array of ints and floats', () => {
      expect(calculateMax([100, 200, 300, 400, 500])).toBe(500);
      expect(calculateMax([100.54, 201.69, 302.55, 988.25, 631.12])).toBe(988.25);
    });

    test('can identify the largest value in an array of mixed types', () => {
      expect(
        calculateMax([
          1,
          86,
          '55',
          46.33,
          '47.55',
          BigNumber(8041.663321),
          485,
          '99.11',
          BigNumber(-800.654),
        ]),
      ).toBe(8041.66);
    });
  });

  describe('calculateMean', () => {
    test('returns 0 if an empty list of values is provided', () => {
      expect(calculateMean([])).toBe(0);
    });

    test('can calculate the mean for a list comprised by integers and floats', () => {
      expect(calculateMean([100, 200, 300, 400, 500])).toBe(300);
      expect(calculateMean([100.54, 201.69, 302.55, 988.25, 631.12])).toBe(444.83);
    });

    test('can calculate the mean for a list comprised by values with mixed types', () => {
      expect(
        calculateMean([
          1,
          86,
          '55',
          46.33,
          '47.55',
          BigNumber(8041.663321),
          485,
          '99.11',
          BigNumber(-800.654),
        ]),
      ).toBe(895.67);
    });
  });

  describe('calculateMedian', () => {
    test('returns 0 if an empty list of values is provided', () => {
      expect(calculateMedian([])).toBe(0);
    });

    test('can calculate the mean for a list comprised by integers and floats', () => {
      expect(calculateMedian([342])).toBe(342);
      expect(calculateMedian([342, 654])).toBe(498);
      expect(calculateMedian([342, 654, 987])).toBe(654);
      expect(calculateMedian([1093, 987, 342, 654])).toBe(820.5);
      expect(calculateMedian([342, 654, 987, 1093, 2234, 6243, 7087, 20123])).toBe(1663.5);
      expect(calculateMedian([1093.55, 711.41, 987.13, 342, 654.99, 84.32, -55.99])).toBe(654.99);
      expect(calculateMedian([1093.55, 711.41, 987.13, 342, 654.99, 84.32, -55.99, 25132.33])).toBe(
        683.2,
      );
    });

    test('can calculate the mean for a list comprised by values with mixed types', () => {
      expect(
        calculateMedian([
          1093.55,
          '711.41',
          BigNumber(987.13),
          342,
          '654.99',
          BigNumber(84.32),
          '-55.99',
          25132.33,
        ]),
      ).toBe(683.2);
    });
  });
});

describe('Percentage Calculations', () => {
  describe('calculatePercentageChange', () => {
    test('throws if the oldValue is less than or equal to 0', () => {
      expectToThrowCode(() => calculatePercentageChange(0, 100), ERRORS.NEGATIVE_VALUE_NOT_ALLOWED);
      expectToThrowCode(
        () => calculatePercentageChange(-10, 100),
        ERRORS.NEGATIVE_VALUE_NOT_ALLOWED,
      );
    });

    test('can calculate the % change when a value has not changed', () => {
      expect(calculatePercentageChange(100, 100)).toBe(0);
      expect(calculatePercentageChange(155.55, 155.55)).toBe(0);
    });

    test('can calculate the % change of a value increase', () => {
      expect(calculatePercentageChange(100, 150)).toBe(50);
      expect(calculatePercentageChange(1555.6544122, 554366.123124)).toBe(35535.56);
      expect(calculatePercentageChange(745.655, 1225.446, { decimalPlaces: 4 })).toBe(64.3449);
      expect(calculatePercentageChange(1635.661, 1639.55, { decimalPlaces: 6 })).toBe(0.237763);
      expect(calculatePercentageChange(4.66, 4.67, { decimalPlaces: 6 })).toBe(0.214592);
      expect(
        calculatePercentageChange('5412151.54561245487451', '78998154125.6632113', {
          decimalPlaces: 10,
          type: 'string',
        }),
      ).toBe('1459544.1629522691');
    });

    test('can calculate the % change of a value decrease', () => {
      expect(calculatePercentageChange(150, 100, { decimalPlaces: 4 })).toBe(-33.3333);
      expect(calculatePercentageChange(554366.123124, 1555.6544122, { decimalPlaces: 4 })).toBe(
        -99.7194,
      );
      expect(calculatePercentageChange(1225.446, 745.655, { decimalPlaces: 4 })).toBe(-39.1524);
      expect(calculatePercentageChange(1639.55, 1635.661, { decimalPlaces: 6 })).toBe(-0.237199);
      expect(calculatePercentageChange(4.67, 4.66, { decimalPlaces: 6 })).toBe(-0.214133);
      expect(
        calculatePercentageChange('78998154125.6632113', '5412151.54561245487451', {
          decimalPlaces: 4,
          type: 'string',
        }),
      ).toBe('-99.9931');
    });

    test('a value can only decrease -100%', () => {
      expect(calculatePercentageChange(1, 0)).toBe(-100);
      expect(calculatePercentageChange(1, -1)).toBe(-100);
    });
  });

  describe('adjustByPercentage', () => {
    test('leaves a value as it is at 0%', () => {
      expect(adjustByPercentage(100, 0)).toBe(100);
    });

    test('takes a value down to 0, never below, at -100% or less', () => {
      expect(adjustByPercentage(100, -100)).toBe(0);
      expect(adjustByPercentage(100, -150)).toBe(0);
    });

    test('keeps 0 at 0, whatever the percentage', () => {
      expect(adjustByPercentage(0, 100)).toBe(0);
      expect(adjustByPercentage(0, -50)).toBe(0);
      expect(adjustByPercentage('0', 0, { type: 'string' })).toBe('0');
    });

    test('throws if the value is negative', () => {
      expectToThrowCode(() => adjustByPercentage(-10, 100), ERRORS.NEGATIVE_VALUE_NOT_ALLOWED);
      expectToThrowCode(() => adjustByPercentage(-0.01, 0), ERRORS.NEGATIVE_VALUE_NOT_ALLOWED);
    });

    test('can increase values by percentage', () => {
      expect(adjustByPercentage(100, 50)).toBe(150);
      expect(adjustByPercentage(100, 100)).toBe(200);
      expect(adjustByPercentage(57700, 1)).toBe(58277);
      expect(adjustByPercentage(57700, 3.95)).toBe(59979.15);
      expect(adjustByPercentage(12.55, 10889500)).toBe(1366644.8);
      expect(adjustByPercentage(64842.66, 0.00599914)).toBe(64846.55);
      expect(adjustByPercentage(64842.66, 0.00154219)).toBe(64843.66);
      expect(adjustByPercentage(76366.9654123, 11.8864, { decimalPlaces: 7 })).toBe(85444.2483891);
    });

    test('can decrease values by percentage', () => {
      expect(adjustByPercentage(100, -50)).toBe(50);
      expect(adjustByPercentage(100, -90)).toBe(10);
      expect(adjustByPercentage(100, -99.99)).toBe(0.01);
      expect(adjustByPercentage(57700, -2)).toBe(56546);
      expect(adjustByPercentage(56936.63, -35)).toBe(37008.81);
      expect(adjustByPercentage(68355.66, -88.9487)).toBe(7554.19);
      expect(adjustByPercentage(12.536, -0.00797703, { decimalPlaces: 3 })).toBe(12.535);
      expect(adjustByPercentage(51042366.652316645, -99.9989)).toBe(561.47);
    });

    test('a value can only decrease 100%', () => {
      expect(adjustByPercentage(100, -100)).toBe(0);
      expect(adjustByPercentage(100, -5000)).toBe(0);
    });
  });

  describe('calculatePercentageRepresentation', () => {
    test('throws if the value or the total are less than or equal to 0', () => {
      expectToThrowCode(
        () => calculatePercentageRepresentation(-1, 100),
        ERRORS.NEGATIVE_VALUE_NOT_ALLOWED,
      );
      expectToThrowCode(
        () => calculatePercentageRepresentation(-10, 100),
        ERRORS.NEGATIVE_VALUE_NOT_ALLOWED,
      );
      expectToThrowCode(
        () => calculatePercentageRepresentation(100, 0),
        ERRORS.NEGATIVE_VALUE_NOT_ALLOWED,
      );
      expectToThrowCode(
        () => calculatePercentageRepresentation(100, -10),
        ERRORS.NEGATIVE_VALUE_NOT_ALLOWED,
      );
    });

    test('can calculate the percentage representation of a value', () => {
      expect(calculatePercentageRepresentation(0, 100)).toBe(0);
      expect(calculatePercentageRepresentation(50, 100)).toBe(50);
      expect(calculatePercentageRepresentation(100, 1000)).toBe(10);
      expect(calculatePercentageRepresentation(30, 100)).toBe(30);
      expect(calculatePercentageRepresentation(26, 50)).toBe(52);
      expect(calculatePercentageRepresentation(24, 50)).toBe(48);
      expect(calculatePercentageRepresentation(5, 50)).toBe(10);
      expect(calculatePercentageRepresentation(50, 75, { decimalPlaces: 3 })).toBe(66.667);
      expect(calculatePercentageRepresentation(1, 3)).toBe(33.33);
      expect(calculatePercentageRepresentation(1.105, 2997)).toBe(0.04);
      expect(calculatePercentageRepresentation(5000, 1000)).toBe(500);
    });
  });
});

describe('Financial Calculations', () => {
  describe('calculateExchange', () => {
    test("throws if the value or the rate aren't positive values", () => {
      expectToThrowCode(() => calculateExchange(0, 1), ERRORS.NEGATIVE_VALUE_NOT_ALLOWED);
      expectToThrowCode(() => calculateExchange(-1, 1), ERRORS.NEGATIVE_VALUE_NOT_ALLOWED);
      expectToThrowCode(() => calculateExchange(1, 0), ERRORS.NEGATIVE_VALUE_NOT_ALLOWED);
      expectToThrowCode(() => calculateExchange(1, -1), ERRORS.NEGATIVE_VALUE_NOT_ALLOWED);
    });

    test('can calculate the exchange of an asset for another based on a rate', () => {
      expect(calculateExchange(100, 65000, { decimalPlaces: 5 })).toBe(0.00154);
      expect(calculateExchange(158794.2755, 64813.99)).toBe(2.45);
      expect(calculateExchange(0.6481399, 64813.99, { decimalPlaces: 5 })).toBe(0.00001);
      expect(calculateExchange(132798.00856, 85.64, { decimalPlaces: 3 })).toBe(1550.654);
      expect(calculateExchange(132280620.0666, 85.64, { decimalPlaces: 3 })).toBe(1544612.565);
      expect(calculateExchange(2032794.0782869, 0.0001691)).toBe(12021254159);
      expect(calculateExchange(0.0001691, 0.0001691)).toBe(1);
      expect(calculateExchange(0.08970286, 0.05409, { decimalPlaces: 4 })).toBe(1.6584);
      expect(calculateExchange(3761.5024395, 0.05409)).toBe(69541.55);
      expect(calculateExchange(8476.59012425, 0.00001003)).toBe(845123641.5);
      expect(calculateExchange('6584205701.94816543', 0.00001003)).toBe(656451216545181);
    });
  });

  describe('calculateExchangeFee', () => {
    test("throws if the value or the fee aren't positive values", () => {
      expectToThrowCode(() => calculateExchangeFee(0, 0.1), ERRORS.NEGATIVE_VALUE_NOT_ALLOWED);
      expectToThrowCode(() => calculateExchangeFee(-1, 0.1), ERRORS.NEGATIVE_VALUE_NOT_ALLOWED);
      expectToThrowCode(() => calculateExchangeFee(1, -0.1), ERRORS.NEGATIVE_VALUE_NOT_ALLOWED);
    });

    test('the feePercentage can be zero', () => {
      expect(calculateExchangeFee(100, 0)).toBe(0);
    });

    test('can calculate the fee that will be charged to any exchange', () => {
      expect(calculateExchangeFee(1000, 1)).toBe(10);
      expect(calculateExchangeFee(300, 10)).toBe(30);
      expect(calculateExchangeFee(100, 35)).toBe(35);
      expect(calculateExchangeFee(25.2774561, 0.075, { decimalPlaces: 8 })).toBe(0.01895809);
      expect(calculateExchangeFee(1007857.5445, 0.075, { decimalPlaces: 8 })).toBe(755.89315838);
      expect(calculateExchangeFee(158794.2755, 0.075, { decimalPlaces: 8 })).toBe(119.09570663);
    });
  });

  describe('calculateWeightedEntry', () => {
    test('returns 0 if an empty list of values is provided', () => {
      expect(calculateWeightedEntry([])).toBe(0);
    });

    test('returns 0 when the amounts add up to 0, instead of dividing by zero', () => {
      expect(
        calculateWeightedEntry([
          [100, 0],
          [200, 0],
        ]),
      ).toBe(0);
      expect(
        calculateWeightedEntry(
          [
            [100, 5],
            [200, -5],
          ],
          { type: 'string' },
        ),
      ).toBe('0');
    });

    test('throws INVALID_VALUE for a trade with an invalid amount', () => {
      expectToThrowCode(() => calculateWeightedEntry([[100, 'abc']]), ERRORS.INVALID_VALUE);
    });

    test('can calculate the weighted entry price for a position (1)', () => {
      expect(
        calculateWeightedEntry([
          [27340.15, 0.01],
          [22077.21, 0.03],
          [21175.76, 0.08],
        ]),
      ).toBe(21914.82);
    });

    test('can calculate the weighted entry price for a position (2)', () => {
      expect(
        calculateWeightedEntry([
          [15699.65, 0.13562],
          [15500.32, 0.2421],
          [16665.88, 0.16644],
          [19555.11, 0.2886],
          [24655.44, 0.16665],
          [22113.65, 0.2001],
          [28966.11, 0.13661],
          [33154.24, 0.1774],
          [36764.81, 0.266],
          [32145.46, 0.18546],
        ]),
      ).toBe(24637.82);
    });

    test('throws if an invalid array of values is provided', () => {
      expectToThrowCode(() => calculateWeightedEntry(undefined!), ERRORS.INVALID_VALUES_ARRAY);
      expectToThrowCode(() => calculateWeightedEntry(null!), ERRORS.INVALID_VALUES_ARRAY);
      // @ts-expect-error: passes what untyped JavaScript callers can
      expectToThrowCode(() => calculateWeightedEntry({}), ERRORS.INVALID_VALUES_ARRAY);
      // @ts-expect-error: passes what untyped JavaScript callers can
      expectToThrowCode(() => calculateWeightedEntry(1), ERRORS.INVALID_VALUES_ARRAY);
      // @ts-expect-error: passes what untyped JavaScript callers can
      expectToThrowCode(() => calculateWeightedEntry('asd'), ERRORS.INVALID_VALUES_ARRAY);
    });
  });
});
