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

The first release of `jg-api-response`, which replaces `api-response-utils` 1.1.1.

### Added

- `IParsedAPIResponse<T>`, the envelope as it arrives after `JSON.parse`.

### Changed

- `isResponse` accepts parsed envelopes, including `error: null`, and narrows to `IParsedAPIResponse<T>`.
- `buildResponse` turns any error that is passed, even a falsy one, into a message.
- Error messages come from `jg-exception`, and the unused zod dependency is gone.
