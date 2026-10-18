# Changelog

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
