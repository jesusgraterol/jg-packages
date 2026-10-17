# Changelog

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Changed

- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- `IJSONValue` is `jg-exception`'s, re-exported under the same name, so an object's values may also be `undefined`, which `JSON.stringify` drops.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release of `jg-utilities`, which replaces `web-utils-kit` 1.4.0.

### Added

- `ERRORS`, the codes of every error the package throws.
- `createTimestamp`, which formats a date, an epoch, or a date string as an ISO 8601 timestamp.
- `encodeCursor` and `decodeCursor`, for opaque pagination cursors, with the `INVALID_CURSOR` code.
- The `ONE_SECOND_IN_MILLISECONDS` to `ONE_YEAR_IN_MILLISECONDS` constants.

### Changed

- The random generators and `shuffleArray` draw from `crypto.getRandomValues` with rejection sampling.
- `isEqual` compares primitives, `null`, and `undefined` with `Object.is` instead of throwing.
- Errors are `Exception`s from `jg-exception`.

### Removed

- `createDeepClone`, replaced by the built-in `structuredClone`, and its `UNABLE_TO_CREATE_DEEP_CLONE` code.
- `expectToThrowCode` and `expectToRejectCode`, which moved to `jg-exception/testing`.
