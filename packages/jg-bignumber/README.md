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

## Documentation

The full API reference is at https://jg-packages.jesusgraterol.dev/packages/jg-bignumber/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-bignumber/LICENSE)
