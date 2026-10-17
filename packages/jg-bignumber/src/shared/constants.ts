import { BigNumber as BigNumberJs } from 'bignumber.js';

/*
 * The BigNumber constructor every function uses: a clone of bignumber.js's, so the package never
 * changes the global bignumber.js configuration other code relies on. It never switches to
 * exponential notation, and with STRICT off an invalid value becomes NaN instead of throwing, which
 * the package then reports as INVALID_VALUE.
 */
export const BigNumber = BigNumberJs.clone({ EXPONENTIAL_AT: 1e9, STRICT: false });
