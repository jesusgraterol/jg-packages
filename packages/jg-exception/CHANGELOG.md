# Changelog

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- `toJSON()` on `Exception`, which `JSON.stringify` calls: `{ name, code, message, data }`, with `null` for data that is missing or can't be serialized.
- `IExceptionOptions`, `IExceptionJSON`, and `IJSONValue`, the type of an Exception's `data`.
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
