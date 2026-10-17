import { BigNumber as GlobalBigNumber } from 'bignumber.js';
import { describe, expect, test } from 'vitest';

describe('BigNumber', () => {
  test("is a clone, so importing the package leaves bignumber.js's global configuration alone", async () => {
    const before = GlobalBigNumber.config({});

    const { BigNumber } = await import('./constants.js');

    expect(GlobalBigNumber.config({})).toStrictEqual(before);
    expect(BigNumber).not.toBe(GlobalBigNumber);
    expect(BigNumber.config({})).toMatchObject({ EXPONENTIAL_AT: [-1e9, 1e9], STRICT: false });
  });

  test('never switches to exponential notation, and turns invalid strings into NaN', async () => {
    const { BigNumber } = await import('./constants.js');

    expect(BigNumber('1e30').toString()).toBe('1000000000000000000000000000000');
    expect(BigNumber('not a number').isNaN()).toBe(true);
  });
});
