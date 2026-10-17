# Changelog

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release of `jg-bignumber`, which replaces `bignumber-utils` 1.1.0.

### Added

- `BigNumber`, the package's own bignumber.js constructor.
- `ERRORS`, the codes of every error the package throws.

### Changed

- `decimalPlaces` applies to every rounding mode, including `*_CEIL` and `*_FLOOR`.
- `NaN` and `±Infinity` are rejected as `INVALID_VALUE`.
- `calculateWeightedEntry` returns 0 when the amounts add up to 0.
- The package no longer changes the global bignumber.js configuration, and it uses bignumber.js 11.
- Errors are `Exception`s from `jg-exception`.
