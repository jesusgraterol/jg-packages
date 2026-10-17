# Changelog

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Changed

- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- `prettifyValue` passes an `Exception` from the processing step through unchanged, and wraps any other error in `INVALID_BIGNUMBER_FORMAT`.
- Error messages say what failed at that step and keep the error underneath as `cause`, instead of repeating its message, so `extractMessage` prints each layer of the chain once.

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
