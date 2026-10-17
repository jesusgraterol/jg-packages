# Changelog

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- `IAPIError`, the error an envelope carries: `{ code, message, data }`.
- `IParsedAPIError`, an envelope error as it arrives from any service, with optional, unchecked `data`.

### Changed

- An envelope's `error` is `{ code, message, data }` instead of a message, and `null` instead of `undefined` on success.
- `buildResponse` keeps an Exception's code, message, and data, with `null` for data that can't be serialized. Any other error keeps its string `code`, or gets `UNKNOWN_ERROR`, and its message, with `null` data.
- `isResponse` accepts an `error` that is `null`, missing, or an object with a string `code` and `message`, and rejects a string `error`.
- `IAPIResponse` is a type alias instead of an interface.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release.

### Added

- `buildResponse`, which builds the `{ success, data, error }` envelope, with any error that is passed, even a falsy one, as its message.
- `isResponse`, which recognises an envelope, including one parsed from JSON with `error: null` or missing fields, and narrows it to `IParsedAPIResponse<T>`.
- The `IAPIResponse<T>` and `IParsedAPIResponse<T>` types.
