# Changelog

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Changed

- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- `IJSONValue` is `jg-exception`'s, re-exported under the same name, so an object's values may also be `undefined`, which `JSON.stringify` drops.
- Error messages say what failed at that step and keep the error underneath as `cause`, instead of repeating its message, so `extractMessage` prints each layer of the chain once.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release.

### Added

- Validations, such as `isEmailValid`, `isUUIDValid`, and `isEqual`, which compares any values.
- Transformers, such as `toSlug`, `createTimestamp`, `prettifyNumber`, and `encodeCursor` and `decodeCursor` for opaque pagination cursors.
- Generators, such as `generateUUID` and `generateRandomString`, and `shuffleArray`, which draw from `crypto.getRandomValues` with rejection sampling.
- Collection, sorting, async, and environment utilities, such as `pickProps`, `sortRecords`, `retryAsyncFunction`, and `hasWindow`.
- The `ONE_SECOND_IN_MILLISECONDS` to `ONE_YEAR_IN_MILLISECONDS` constants, and `ERRORS`, the codes of every error the package throws.
