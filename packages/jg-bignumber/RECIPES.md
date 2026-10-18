# jg-bignumber recipes

Patterns for apps that add up money and report how a metric changed, with exact decimal math and rounding where you choose.

## Summing money without rounding errors

Use this for a cart, an invoice, or any total of prices. JavaScript numbers are binary fractions, so `0.1 + 0.2` is `0.30000000000000004`, and each addition can add an error. Keep amounts as decimal strings from the API or the database, do the arithmetic with jg-bignumber, and round where the invoice rounds:

```ts
import { calculateSum, getBigNumber, processValue, type IBigNumber } from 'jg-bignumber';

// a line of an invoice, with its price as a decimal string, as an API or a PostgreSQL numeric
// column sends it, so it never passes through a float
type IInvoiceLine = { unitPrice: string; quantity: number };

type IInvoiceTotals = { subtotal: IBigNumber; tax: IBigNumber; total: IBigNumber };

// the reader's invoice, with its tax rate as a percentage, such as '8.25'
declare const invoice: { lines: IInvoiceLine[]; taxRate: string };

// the cell that shows the invoice's total
declare const totalCell: HTMLElement;

const calculateInvoiceTotals = (lines: IInvoiceLine[], taxRate: string): IInvoiceTotals => {
  // each line's total stays exact, so nothing is rounded before the sum
  const lineTotals = lines.map(({ unitPrice, quantity }) =>
    getBigNumber(unitPrice).times(quantity),
  );

  // the subtotal and the tax are each rounded to cents, as the invoice prints them, so the
  // printed amounts add up to the printed total
  const subtotal = calculateSum(lineTotals, { type: 'bignumber' });
  const tax = processValue(subtotal.times(taxRate).dividedBy(100), { type: 'bignumber' });
  return { subtotal, tax, total: calculateSum([subtotal, tax], { type: 'bignumber' }) };
};

const { total } = calculateInvoiceTotals(invoice.lines, invoice.taxRate);

// toFixed and toFormat keep the cents, such as '1234.50' and '1,234.50', where a number or
// prettifyValue drops the trailing zero
const totalForApi = total.toFixed(2);
totalCell.textContent = `$${total.toFormat(2)}`;
```

Every jg-bignumber calculation, and `processValue`, rounds its result, so call one where the invoice rounds, and do the steps in between with BigNumber methods, such as `times` and `dividedBy`, which don't. `{ type: 'bignumber' }` returns a BigNumber instead of a number, so the next step starts from the decimal value. Results round to 2 decimal places with `ROUND_HALF_UP`: pass `roundingMode: 'ROUND_HALF_EVEN'` where an accounting rule asks for banker's rounding, or `decimalPlaces: 0` for a currency without cents. A string that isn't a number, such as `''` from an empty form field, throws `INVALID_VALUE`, so check input with `isNumber` before it reaches the math.

## A percentage change for a dashboard

Use this for a metric tile that compares a period with the one before, such as this month's revenue against last month's. `calculatePercentageChange` returns a signed percentage, and `prettifyValue` formats it with a sign and a suffix:

```ts
import {
  calculatePercentageChange,
  getBigNumber,
  prettifyValue,
  type IBigNumberValue,
} from 'jg-bignumber';

// how a metric moved, which picks the tile's arrow and color
type ITrend = 'up' | 'down' | 'flat';

type IChange = { label: string; trend: ITrend };

// the reader's revenue for the last two months, and the tile's change label
declare const revenue: { previous: string; current: string };
declare const changeLabel: HTMLElement;

// describes how a metric changed, or returns null when the previous value can't be the base
const describeChange = (previous: IBigNumberValue, current: IBigNumberValue): IChange | null => {
  // a change from 0, or from a negative value, has no meaningful percentage, and
  // calculatePercentageChange throws NEGATIVE_VALUE_NOT_ALLOWED for one
  if (!getBigNumber(previous).isGreaterThan(0)) {
    return null;
  }

  // rounded to one decimal before the trend is picked, so the arrow always agrees with the label
  const change = calculatePercentageChange(previous, current, { decimalPlaces: 1 });
  let trend: ITrend = 'flat';
  if (change > 0) {
    trend = 'up';
  } else if (change < 0) {
    trend = 'down';
  }

  // only an increase gets a plus sign, so an unchanged metric reads 0%, not +0%
  const label = prettifyValue(change, {
    format: { positiveSign: trend === 'up' ? '+' : '', suffix: '%' },
  });
  return { label, trend };
};

const change = describeChange(revenue.previous, revenue.current);

// revenue that starts from 0 has no percentage, so the tile says it's new
changeLabel.textContent = change?.label ?? 'New';
changeLabel.dataset['trend'] = change?.trend ?? 'flat';
```

A change too small to show, such as 0.04%, rounds to 0 and reads as flat, never as an arrow next to 0%. The largest decrease is -100%, which `calculatePercentageChange` returns whenever the current value is 0 or less. `prettifyValue` groups thousands, as in `+1,234.6%`, and drops trailing zeros, so 12% and 12.5% can sit side by side.
