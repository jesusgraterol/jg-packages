# Changelog

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
