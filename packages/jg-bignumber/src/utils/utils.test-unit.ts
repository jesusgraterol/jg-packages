import { extractMessage } from 'jg-exception';
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, test, expect } from 'vitest';
import { BigNumber } from '../shared/constants.js';
import type {
  IBigNumberRoundingModeName,
  IBigNumberFormat,
  IConfig,
  IType,
} from '../shared/types.js';
import { ERRORS } from '../shared/errors.js';
import {
  buildInvalidValueException,
  buildConfig,
  roundBigNumber,
  convertBigNumberToType,
  buildFormatConfig,
  sortBigNumbers,
} from './utils.js';

/* ************************************************************************************************
 *                                           CONSTANTS                                            *
 ************************************************************************************************ */

// invalid value mocks
const iv = BigNumber(NaN);

// default build config
const dbc: IConfig = { decimalPlaces: 2, roundingMode: 'ROUND_HALF_UP', type: 'number' };

// default format config
const dfc: IBigNumberFormat = {
  prefix: '',
  negativeSign: '-',
  positiveSign: '',
  decimalSeparator: '.',
  groupSeparator: ',',
  groupSize: 3,
  secondaryGroupSize: 0,
  fractionGroupSeparator: ' ',
  fractionGroupSize: 0,
  suffix: '',
};

/* ************************************************************************************************
 *                                             TESTS                                              *
 ************************************************************************************************ */

describe('buildInvalidValueException', () => {
  test('builds an INVALID_VALUE exception naming the value', () => {
    const exception = buildInvalidValueException(iv);

    expect(exception.code).toBe(ERRORS.INVALID_VALUE);
    expect(exception.message).toBe('BigNumber could not be instantiated with: NaN.');
  });

  test("keeps the bignumber.js error as the cause, and its message out of the exception's", () => {
    const err = new Error('There has been an error while instantiating BigNumber');
    const exception = buildInvalidValueException(iv, err);

    expect(exception).toMatchObject({
      code: ERRORS.INVALID_VALUE,
      message: 'BigNumber could not be instantiated with: NaN.',
      cause: err,
    });
    expect(extractMessage(exception)).toBe(
      `BigNumber could not be instantiated with: NaN.; [CAUSE]: ${err.message}`,
    );
  });

  test("describes a value that can't be stringified as UNKNOWN", () => {
    const err = new Error('There has been an error while instantiating BigNumber');

    expect(buildInvalidValueException(Object.create(null)).message).toBe(
      'BigNumber could not be instantiated with: UNKNOWN.',
    );
    expect(buildInvalidValueException(Object.create(null), err).message).toBe(
      'BigNumber could not be instantiated with: UNKNOWN.',
    );
  });
});

describe('buildConfig', () => {
  test('can build a default config object by providing invalid values', () => {
    [
      buildConfig(),
      buildConfig(undefined),
      buildConfig(null!),
      buildConfig({}),
      buildConfig({ decimalPlaces: undefined, roundingMode: undefined, type: undefined } as never),
    ].forEach((val) => {
      expect(val).toStrictEqual(dbc);
    });
  });

  test('can build a config object by providing a partial config object', () => {
    expect(buildConfig({ decimalPlaces: 8 })).toStrictEqual({ ...dbc, decimalPlaces: 8 });
    expect(buildConfig({ roundingMode: 'ROUND_HALF_EVEN' })).toStrictEqual({
      ...dbc,
      roundingMode: 'ROUND_HALF_EVEN',
    });
    expect(buildConfig({ type: 'string' })).toStrictEqual({ ...dbc, type: 'string' });
    expect(
      buildConfig({
        type: 'bignumber',
        decimalPlaces: 6,
      }),
    ).toStrictEqual({ ...dbc, type: 'bignumber', decimalPlaces: 6 });
  });

  test('can build a config object by providing a complete config object', () => {
    const config: IConfig = { decimalPlaces: 4, roundingMode: 'ROUND_HALF_DOWN', type: 'string' };
    expect(buildConfig(config)).toStrictEqual(config);
  });

  test.each([
    ['ROUND_UP'],
    ['ROUND_DOWN'],
    ['ROUND_CEIL'],
    ['ROUND_FLOOR'],
    ['ROUND_HALF_UP'],
    ['ROUND_HALF_DOWN'],
    ['ROUND_HALF_EVEN'],
    ['ROUND_HALF_CEIL'],
    ['ROUND_HALF_FLOOR'],
  ] as const)('buildConfig({ roundingMode: %s }) -> keeps the decimal places', (roundingMode) => {
    expect(buildConfig({ roundingMode }).decimalPlaces).toBe(dbc.decimalPlaces);
    expect(buildConfig({ roundingMode, decimalPlaces: 4 }).decimalPlaces).toBe(4);
  });

  test('throws if an invalid decimalPlaces value is provided', () => {
    [-0.001, -0.00542154, -100, Infinity, -Infinity, 101].forEach((val) => {
      expectToThrowCode(() => buildConfig({ decimalPlaces: val }), ERRORS.INVALID_DECIMAL_PLACES);
    });
  });
});

describe('roundBigNumber', () => {
  // test.todo('can apply the ROUND_UP mode with any number of decimal places');

  // test.todo('can apply the ROUND_DOWN mode with any number of decimal places');

  test('can apply the ROUND_CEIL mode with any number of decimal places', () => {
    expect(roundBigNumber(BigNumber('1.01'), 0, 'ROUND_CEIL').toString()).toBe('2');
    expect(roundBigNumber(BigNumber('1.5'), 0, 'ROUND_CEIL').toString()).toBe('2');
    expect(roundBigNumber(BigNumber('1.0000000000000005'), 0, 'ROUND_CEIL').toString()).toBe('2');
    expect(roundBigNumber(BigNumber('512.155'), 0, 'ROUND_CEIL').toString()).toBe('513');
    expect(roundBigNumber(BigNumber('999'), 0, 'ROUND_CEIL').toString()).toBe('999');
    expect(roundBigNumber(BigNumber('5.000000000001'), 0, 'ROUND_CEIL').toString()).toBe('6');
    expect(
      roundBigNumber(BigNumber('1005421251254.8841256948841256944'), 0, 'ROUND_CEIL').toString(),
    ).toBe('1005421251255');
  });

  test('can apply the ROUND_FLOOR mode with any number of decimal places', () => {
    expect(roundBigNumber(BigNumber('1.01'), 0, 'ROUND_FLOOR').toString()).toBe('1');
    expect(roundBigNumber(BigNumber('1.5'), 0, 'ROUND_FLOOR').toString()).toBe('1');
    expect(roundBigNumber(BigNumber('1.999999999999999999'), 0, 'ROUND_FLOOR').toString()).toBe(
      '1',
    );
    expect(roundBigNumber(BigNumber('512.155'), 0, 'ROUND_FLOOR').toString()).toBe('512');
    expect(roundBigNumber(BigNumber('999'), 2, 'ROUND_FLOOR').toString()).toBe('999');
    expect(roundBigNumber(BigNumber('5.000000000001'), 0, 'ROUND_FLOOR').toString()).toBe('5');
    expect(
      roundBigNumber(BigNumber('1005421251254.8841256948841256944'), 0, 'ROUND_FLOOR').toString(),
    ).toBe('1005421251254');
  });

  test('can apply the ROUND_HALF_UP mode with any number of decimal places', () => {
    expect(roundBigNumber(BigNumber('1.5'), 0, 'ROUND_HALF_UP').toString()).toBe('2');
    expect(roundBigNumber(BigNumber(1.556), 2, 'ROUND_HALF_UP').toString()).toBe('1.56');
    expect(roundBigNumber(BigNumber(1.555), 2, 'ROUND_HALF_UP').toString()).toBe('1.56');
    expect(roundBigNumber(BigNumber(1.554), 2, 'ROUND_HALF_UP').toString()).toBe('1.55');
    expect(roundBigNumber(BigNumber('1054.884125695'), 7, 'ROUND_HALF_UP').toString()).toBe(
      '1054.8841257',
    );
    expect(roundBigNumber(BigNumber('1054.884125694'), 8, 'ROUND_HALF_UP').toString()).toBe(
      '1054.88412569',
    );
    expect(
      roundBigNumber(
        BigNumber('1005421251254.8841256948841256944'),
        18,
        'ROUND_HALF_UP',
      ).toString(),
    ).toBe('1005421251254.884125694884125694');
    expect(
      roundBigNumber(
        BigNumber('1005421251254.8841256948841256945'),
        18,
        'ROUND_HALF_UP',
      ).toString(),
    ).toBe('1005421251254.884125694884125695');
  });

  test('can apply the ROUND_HALF_DOWN mode with any number of decimal places', () => {
    expect(roundBigNumber(BigNumber('1.5'), 0, 'ROUND_HALF_DOWN').toString()).toBe('1');
    expect(roundBigNumber(BigNumber(1.556), 2, 'ROUND_HALF_DOWN').toString()).toBe('1.56');
    expect(roundBigNumber(BigNumber(1.555), 2, 'ROUND_HALF_DOWN').toString()).toBe('1.55');
    expect(roundBigNumber(BigNumber(1.554), 2, 'ROUND_HALF_DOWN').toString()).toBe('1.55');
    expect(roundBigNumber(BigNumber('1054.884125695'), 7, 'ROUND_HALF_DOWN').toString()).toBe(
      '1054.8841257',
    );
    expect(roundBigNumber(BigNumber('1054.884125694'), 8, 'ROUND_HALF_DOWN').toString()).toBe(
      '1054.88412569',
    );
    expect(
      roundBigNumber(
        BigNumber('1005421251254.8841256948841256944'),
        18,
        'ROUND_HALF_DOWN',
      ).toString(),
    ).toBe('1005421251254.884125694884125694');
    expect(
      roundBigNumber(
        BigNumber('1005421251254.8841256948841256945'),
        18,
        'ROUND_HALF_DOWN',
      ).toString(),
    ).toBe('1005421251254.884125694884125694');
  });

  // test.todo('can apply the ROUND_HALF_EVEN mode with any number of decimal places');

  // test.todo('can apply the ROUND_HALF_CEIL mode with any number of decimal places');

  // test.todo('can apply the ROUND_HALF_FLOOR mode with any number of decimal places');

  test('throws if an invalid rounding mode is provided', () => {
    expectToThrowCode(
      () => roundBigNumber(BigNumber(1.565), 2, <IBigNumberRoundingModeName>'invalid'),
      ERRORS.INVALID_ROUNDING_MODE,
    );
  });
});

describe('convertBigNumberToType', () => {
  test('can convert a BigNumber into a string', () => {
    [
      BigNumber(123),
      BigNumber('54645.1254'),
      BigNumber('554154223548450215454.5451212445461242'),
    ].forEach((v) => {
      expect(convertBigNumberToType(v, 'string')).toBe(v.toString());
    });
  });

  test('can convert a BigNumber into a number', () => {
    [BigNumber(123), BigNumber(54645.1254), BigNumber(14512.546542124548)].forEach((v) => {
      expect(convertBigNumberToType(v, 'number')).toBe(v.toNumber());
    });
  });

  test('can convert a BigNumber into a BigNumber', () => {
    [BigNumber(123), BigNumber(54645.1254), BigNumber(14512.546542124548)].forEach((v) => {
      const val = convertBigNumberToType(v, 'bignumber');
      expect(BigNumber.isBigNumber(val)).toBe(true);
      expect(v.isEqualTo(val)).toBe(true);
    });
  });

  test('throws if an invalid type is provided', () => {
    expectToThrowCode(
      () => convertBigNumberToType(BigNumber(100), <IType>'something'),
      ERRORS.INVALID_TYPE,
    );
  });
});

describe('buildFormatConfig', () => {
  test('can build a default config object by providing invalid values', () => {
    [
      buildFormatConfig(),
      buildFormatConfig(undefined),
      buildFormatConfig(null!),
      buildFormatConfig({}),
      buildFormatConfig({
        prefix: undefined,
        decimalSeparator: undefined,
        groupSeparator: undefined,
        groupSize: undefined,
        secondaryGroupSize: undefined,
        fractionGroupSeparator: undefined,
        fractionGroupSize: undefined,
        suffix: undefined,
      } as never),
    ].forEach((val) => {
      expect(val).toStrictEqual(dfc);
    });
  });

  test('can build a config object by providing a partial config object', () => {
    expect(buildFormatConfig({ prefix: '$' })).toStrictEqual({ ...dfc, prefix: '$' });
    expect(
      buildFormatConfig({ decimalSeparator: ',', groupSeparator: '.', suffix: 'BTC' }),
    ).toStrictEqual({
      ...dfc,
      decimalSeparator: ',',
      groupSeparator: '.',
      suffix: 'BTC',
    });
  });

  test('can build a config object by providing a complete config object', () => {
    const config: IBigNumberFormat = {
      prefix: '$',
      negativeSign: '-',
      positiveSign: '',
      decimalSeparator: ',',
      groupSeparator: '.',
      groupSize: 5,
      secondaryGroupSize: 3,
      fractionGroupSeparator: ' / ',
      fractionGroupSize: 2,
      suffix: 'Bitcoin',
    };
    expect(buildFormatConfig(config)).toStrictEqual(config);
  });
});

describe('sortBigNumbers', () => {
  test('can determine the correct order value based on the given sort order', () => {
    expect(sortBigNumbers('asc')(BigNumber(1), BigNumber(1))).toBe(0);
    expect(sortBigNumbers('asc')(BigNumber(1), BigNumber(2))).toBe(-1);
    expect(sortBigNumbers('asc')(BigNumber(2), BigNumber(1))).toBe(1);

    expect(sortBigNumbers('desc')(BigNumber(1), BigNumber(1))).toBe(0);
    expect(sortBigNumbers('desc')(BigNumber(1), BigNumber(2))).toBe(1);
    expect(sortBigNumbers('desc')(BigNumber(2), BigNumber(1))).toBe(-1);
  });

  test('can sort a list of BigNumbers ascendingly', () => {
    const bns = [BigNumber(5), BigNumber(7), BigNumber(4), BigNumber(15)];
    bns.sort(sortBigNumbers('asc'));
    expect(bns).toStrictEqual([BigNumber(4), BigNumber(5), BigNumber(7), BigNumber(15)]);
  });

  test('can sort a list of BigNumbers descendingly', () => {
    const bns = [BigNumber(5), BigNumber(7), BigNumber(4), BigNumber(15)];
    bns.sort(sortBigNumbers('desc'));
    expect(bns).toStrictEqual([BigNumber(15), BigNumber(7), BigNumber(5), BigNumber(4)]);
  });
});
