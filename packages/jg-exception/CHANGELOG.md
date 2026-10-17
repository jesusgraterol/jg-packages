# Changelog

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release of `jg-exception`, which replaces `error-message-utils` 1.2.14.

### Added

- `isException(value)`, which recognises an `Exception` from any installed copy of the package.
- The `jg-exception/testing` entry, with `expectToThrowCode` and `expectToRejectCode` moved from `web-utils-kit`.

### Changed

- Decoded codes are always strings, and `DEFAULT_CODE` is `'-1'`.
- `hasErrorCode` and `hasErrorCodePrefix` compare codes as strings.
- ZodErrors are recognised by their shape, and zod is no longer a dependency.
