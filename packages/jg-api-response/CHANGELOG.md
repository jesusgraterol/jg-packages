# Changelog

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
