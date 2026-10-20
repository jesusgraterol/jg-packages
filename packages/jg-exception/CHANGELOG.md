# Changelog

## 1.6.0

### Changed

- Supports Node.js 22.17.0 and later, down from 24.

## 1.5.0

### Added

- `REDACTED_VALUE`, the `'[redacted]'` marker that replaces each redacted value, so other code, such as jg-utilities' `redactSecrets`, marks what it removes the same way.

## 1.4.0

### Added

- `severity` and `shouldLog` in `Exception`'s options, for an app's throw sites to tell its reporter how serious a failure is, `'expected'` or `'critical'`, and to ask for it to be logged in full. Each is an own property only when given a valid value, neither is serialized, and redacted causes keep both as they are. Packages never set them.
- `IExceptionSeverity` and `EXCEPTION_SEVERITIES`, the severities an Exception accepts.
- `createErrorFeedback(options)`, which creates the function a UI turns errors into feedback with: the copy for the error's code or a fallback, the code when it's safe to show, and whether the error means the user cancelled or was denied access. It never throws.

### Changed

- The recipes "An API exception with an HTTP status and logging flags" and "A client exception for the UI" are replaced by "Severity and logging flags for an error reporter" and "Feedback for the UI", built on `severity`, `shouldLog`, and `createErrorFeedback`.

## 1.3.0

### Added

- `redactFields(value, keys)`, a copy of a value, such as a request body headed for an error report, with the values of the named fields replaced by `[redacted]` at any depth. Keys match case-insensitively, and the original is never changed.
- A recipe for redacting a request in an error report.

## 1.2.0

### Added

- `RECIPES.md`, patterns for apps that use the package: an API exception with an HTTP status and logging flags, a client exception for the UI, keeping secrets out of a cause with `redact`, and handling an error by its code. Each block is typechecked against the release.
- `redact` in `Exception`'s options: values replaced with `[redacted]`, as written and URL-encoded, throughout the exception: its message, its data, and every cause. Each cause becomes a copy that keeps its name, code, and plain fields without running the cause's own code, and nothing keeps the values.

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- `toJSON()` on `Exception`, which `JSON.stringify` calls: `{ name, code, message, data }`, with `null` for data that is missing or can't be serialized.
- `IExceptionOptions`, `IExceptionJson`, and `IJsonValue`, the type of an Exception's `data`.
- `UNKNOWN_ERROR_CODE`, `'UNKNOWN_ERROR'`, the code for an error that has none.
- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.

### Changed

- `new Exception(message, { code, data, cause })` replaces `new Exception(error, code, data, options)`. The code is a required string, `data` is a JSON value, and the message is used as given.
- `toString()` returns `Exception [CODE]: message`.
- `getErrorCode` reads a non-empty string `code` property, such as an Exception's or a Node.js system error's, and nothing else.
- `hasErrorCode` takes a string code, and `expectToThrowCode` and `expectToRejectCode` take string codes.

### Removed

- The `message{(code)}` format and everything around it: `encodeError`, `decodeError`, `isEncodedError`, `DEFAULT_CODE`, and the types `IDecodedError`, `IErrorCode`, and `IErrorCodeCarrier`.
- `Exception#toRecord` and string coercion through `Symbol.toPrimitive`; use `toJSON()` and `toString()`.
- `IErrorOptions` and `IExceptionRecord`.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release.

### Added

- `Exception`, an `Error` with a string code and data.
- `extractMessage` and `extractRedactedMessage`, which read a message from an error of any shape, including its causes and ZodErrors from any copy of zod.
- `getErrorCode`, `hasErrorCode`, and `hasErrorCodePrefix`, which read codes as strings, and `encodeError`, `decodeError`, and `isEncodedError`, which carried codes inside messages.
- `isException(value)`, which recognises an `Exception` from any installed copy of the package.
- The `jg-exception/testing` entry, with `expectToThrowCode` and `expectToRejectCode`.
