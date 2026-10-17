import { test } from 'vitest';

import type { IBigNumberRoundingMode, IBigNumberRoundingModeName } from '../shared/types.js';

// every supported rounding mode name
const ROUNDING_MODE_NAMES: IBigNumberRoundingModeName[] = [
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

// the lookup the package uses
const ROUNDING_MODES: Record<IBigNumberRoundingModeName, IBigNumberRoundingMode> = {
  ROUND_UP: 0,
  ROUND_DOWN: 1,
  ROUND_CEIL: 2,
  ROUND_FLOOR: 3,
  ROUND_HALF_UP: 4,
  ROUND_HALF_DOWN: 5,
  ROUND_HALF_EVEN: 6,
  ROUND_HALF_CEIL: 7,
  ROUND_HALF_FLOOR: 8,
};

// the same lookup written as a switch statement, to compare against the map
const getRoundingModeWithSwitch = (name: IBigNumberRoundingModeName): IBigNumberRoundingMode => {
  switch (name) {
    case 'ROUND_UP':
      return 0;
    case 'ROUND_DOWN':
      return 1;
    case 'ROUND_CEIL':
      return 2;
    case 'ROUND_FLOOR':
      return 3;
    case 'ROUND_HALF_UP':
      return 4;
    case 'ROUND_HALF_DOWN':
      return 5;
    case 'ROUND_HALF_EVEN':
      return 6;
    case 'ROUND_HALF_CEIL':
      return 7;
    default:
      return 8;
  }
};

test('rounding mode lookup', async ({ bench }) => {
  await bench.compare(
    bench('object lookup with Object.hasOwn', () => {
      ROUNDING_MODE_NAMES.forEach((name) =>
        Object.hasOwn(ROUNDING_MODES, name) ? ROUNDING_MODES[name] : undefined,
      );
    }),
    bench('switch', () => {
      ROUNDING_MODE_NAMES.forEach(getRoundingModeWithSwitch);
    }),
  );
});
