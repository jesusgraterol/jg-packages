# Changelog

## 1.2.0

### Added

- `prettifyValue` keeps trailing zeros up to `format.minimumDecimalPlaces`, such as `$1,234.50` for a price, through the new `IPrettifyFormat` type. A minimum past `decimalPlaces` throws `INVALID_BIGNUMBER_FORMAT`.

### Fixed

- `adjustByPercentage` returns 0 for a value of 0, instead of throwing `NEGATIVE_VALUE_NOT_ALLOWED`, which it still throws for a negative value.

## 1.1.1

### Added

- `RECIPES.md`, patterns for apps that use the package: summing money without rounding errors, and a percentage change for a dashboard. Each block is typechecked against the release.

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.

### Changed

- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- `prettifyValue` passes an `Exception` from the processing step through unchanged, and wraps any other error in `INVALID_BIGNUMBER_FORMAT`.
- Error messages say what failed at that step and keep the error underneath as `cause`, instead of repeating its message, so `extractMessage` prints each layer of the chain once.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release.

### Added

- `processValue`, `prettifyValue`, and `getBigNumber`, which round, format, and convert decimal values with bignumber.js 11, with `decimalPlaces` applied to every rounding mode.
- Calculations, such as `calculateSum`, `calculateMean`, `calculatePercentageChange`, and `calculateWeightedEntry`, which returns 0 when the amounts add up to 0.
- `BigNumber`, the package's own bignumber.js constructor, so the global bignumber.js configuration is left alone.
- `ERRORS`, the codes of every error the package throws. `NaN` and `±Infinity` are rejected as `INVALID_VALUE`.
