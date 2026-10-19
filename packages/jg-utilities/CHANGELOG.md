# Changelog

## 1.3.0

### Added

- `toUtcDate(value?)`, the UTC calendar date of an instant as `YYYY-MM-DD`, now when no value is given. An invalid instant throws `INVALID_DATE` instead of a native `RangeError`.
- `getTrailingUtcDateRange(dayCount, value?)`, the inclusive range of the last `dayCount` UTC days ending on an instant's UTC date, and `generateUtcDateSequence(range)`, every date in such a range, oldest first. `INVALID_DAY_COUNT` and `INVALID_DATE_RANGE` reject a day count that isn't a positive safe integer and a range that isn't two real dates in order.
- `truncateToUtf8Bytes(text, maxBytes)`, the longest prefix of whole code points that fits a number of UTF-8 bytes. A limit that isn't a non-negative safe integer throws `INVALID_BYTE_LIMIT`.
- `createEventBus({ onError })`, a typed in-process event bus: `emit` returns at once, each event is delivered later in the order it was emitted, each handler runs on its own with its errors sent to `onError`, and `close()` drops pending deliveries.
- `IUtcDateRange`, `IEventBus`, and `IEventBusOptions`.

## 1.2.0

### Added

- `escapeHtml(text)`, which escapes `&`, `<`, `>`, `"`, and `'` so text can go into HTML.
- `pluralize(count, singular, plural?)`, which picks the word for a count, `singular + 's'` unless the plural is given.
- `resolveSafeInternalPath(candidate, excludedPaths?)`, which returns an untrusted path, such as a `returnTo` parameter, only when it stays on the same site and outside the excluded paths. It rejects absolute and protocol-relative URLs, backslashes, and paths that can't be decoded, and matches excluded paths by whole segments, case-insensitively and after decoding.
- `isBigIntStringValid(value, min?, max?)`, which accepts an integer written in plain decimal digits, as PostgreSQL returns a BIGINT, within a range that defaults to a signed 64-bit integer.

### Fixed

- `prettifyNumber` puts a negative value's sign before the prefix, so `-5` with the prefix `$` is `-$5` instead of `$-5`.

## 1.1.1

### Added

- `RECIPES.md`, patterns for apps that use the package: paginating with cursors, stable cache keys from JSON, and validating input at the edge. Each block is typechecked against the release.

### Fixed

- The `INVALID_AUTHORIZATION_HEADER` and `INVALID_EMAIL_ADDRESS` messages no longer repeat the header or the address they rejected, which could carry a credential or personal data into logs and API responses. The codes are unchanged.

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.

### Changed

- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- `IJsonValue` is `jg-exception`'s, re-exported under the same name, so an object's values may also be `undefined`, which `JSON.stringify` drops.
- Names case acronyms as words, like every other name in the packages:
  - `IJSONValue` is `IJsonValue`, and `IUUIDVersion` is `IUuidVersion`
  - `parseJSON`, `stringifyJSON`, `stringifyJSONDeterministically`, and `pruneJSON` are `parseJson`, `stringifyJson`, `stringifyJsonDeterministically`, and `pruneJson`
  - `generateUUID` is `generateUuid`
  - `isJWTValid`, `isURLValid`, and `isUUIDValid` are `isJwtValid`, `isUrlValid`, and `isUuidValid`
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
