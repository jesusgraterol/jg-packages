# jg-bignumber

Exact decimal math with bignumber.js: rounding, formatting, and sum, mean, percentage, and exchange calculations.

## Install

```bash
npm install jg-bignumber
```

## Usage

Every calculation is exact, then rounded to 2 decimal places with `ROUND_HALF_UP` and returned as a number, unless the configuration asks otherwise:

```ts
import { calculateSum, processValue, prettifyValue } from 'jg-bignumber';

calculateSum([0.1, '0.2', 0.3]); // 0.6, not 0.6000000000000001
processValue(512.155); // 512.16
processValue(19.991, { roundingMode: 'ROUND_CEIL' }); // 20
processValue('0.000001', { decimalPlaces: 6, type: 'string' }); // '0.000001'
prettifyValue(1234.5, { format: { prefix: '$' } }); // '$1,234.5'
```

Percentages and money:

```ts
import {
  adjustByPercentage,
  calculateExchange,
  calculatePercentageChange,
  calculateWeightedEntry,
} from 'jg-bignumber';

calculatePercentageChange(100, 125); // 25
adjustByPercentage(100, -10); // 90
calculateExchange(100, 65000, { decimalPlaces: 8 }); // 0.00153846
calculateWeightedEntry([
  [100, 2],
  [130, 1],
]); // 110, the average price weighted by amount
```

`BigNumber` is the package's own bignumber.js constructor, so creating values with it never changes the global bignumber.js configuration.

## Coming from `bignumber-utils`

| `bignumber-utils`                                                         | `jg-bignumber`                             |
| ------------------------------------------------------------------------- | ------------------------------------------ |
| `import … from 'bignumber-utils'`                                         | `import … from 'jg-bignumber'`             |
| `import { BigNumber } from 'bignumber.js'` for values the package accepts | `import { BigNumber } from 'jg-bignumber'` |

Changed behavior:

- `decimalPlaces` applies to every rounding mode. The `*_CEIL` and `*_FLOOR` modes used to force 0 decimal places; pass `decimalPlaces: 0` for that.
- `NaN` and `±Infinity` are rejected: `getBigNumber`, `processValue`, and the calculations throw `INVALID_VALUE`, and `isNumber` returns `false`.
- Importing the package no longer changes the global bignumber.js configuration.
- `calculateWeightedEntry` returns 0 when the amounts add up to 0, instead of failing.
- Errors are `Exception`s from `jg-exception`, with the same codes, exported as `ERRORS`.
- The package uses bignumber.js 11, whose `IBigNumberFormat` adds `negativeSign` and `positiveSign`.

## Documentation

The full API reference is at https://jg-packages.jesusgraterol.dev/packages/jg-bignumber/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-bignumber/LICENSE)
