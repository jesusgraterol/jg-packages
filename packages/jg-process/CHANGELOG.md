# Changelog

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release of `jg-process`, which replaces `node-process-utils` 1.0.1.

### Added

- `ERRORS`, the codes of every error the package throws.
- `startProcess(command)`, which takes the command, its arguments, and its options in one `IStartProcessCommand` object.

### Changed

- Errors are `Exception`s from `jg-exception`.
