# Changelog

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Changed

- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- Error messages say what failed at that step and keep the error underneath as `cause`, instead of repeating its message, so `extractMessage` prints each layer of the chain once.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release of `jg-fs`, which replaces `fs-utils-async` 1.0.1 and, at `jg-fs/sync`, `fs-utils-sync` 1.2.0.

### Added

- The `jg-fs/sync` entry, with the same functions as the async root entry.
- `ERRORS`, the codes of every error the package throws.

### Changed

- Empty content is allowed when reading and writing text and binary files.
- `createDirectory` succeeds when the directory already exists.
- `includeExts` matches extensions case-insensitively.
- The sync `readDirectory` joins paths with the platform's separator, and the sync `getDirectoryElements` skips entries removed while it reads.
- The async `getDirectoryElements` reads at most 32 entries at once.
- `readFile` returns `string` with an encoding and `Buffer` without one.
- Errors are `Exception`s from `jg-exception`.

### Fixed

- Typos in several error messages.
