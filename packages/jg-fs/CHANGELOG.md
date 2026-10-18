# Changelog

## 1.3.0

### Added

- `acquireLock(path)`, in both entries, which acquires a lock only one process at a time can hold: a directory, created with mode `0o700`, holding an `owner.json` that names the process. A lock whose owner on this host has exited is taken over, under a recovery claim. Any other existing lock throws `LOCK_BUSY`, whose `data.reason` is `held`, `other-host`, `ownerless`, `recovery-in-progress`, or `unexpected-entries`. Its `release()` removes it only while `owner.json` still names the caller and nothing else is inside, and is idempotent.
- `IFileLock` and `IFileLockOwner`, and the codes `LOCK_BUSY`, `LOCK_NOT_OWNED`, `LOCK_RELEASE_FAILED`, and `LOCK_ACQUISITION_FAILED`.
- A README section on removing a stuck lock.

## 1.2.0

### Added

- `readJsonFile` takes `maxBytes`, and then reads the file as `readBoundedFile` does, throwing `FILE_TOO_LARGE` for a larger one, for JSON whose size isn't yours to decide.

### Changed

- `writeJsonFile` writes atomically, as `writeFileAtomic` does, so a crash or a full disk never leaves a truncated file. A symbolic link at the path keeps pointing at the file, whose target is replaced.

### Fixed

- `writeFileAtomic`, and so `writeJsonFile`, tries the rename again for about 4 seconds while Windows refuses it with `EACCES`, `EBUSY`, or `EPERM` because another process, such as an antivirus scanner, holds the file.

## 1.1.1

### Added

- `RECIPES.md`, patterns for apps that use the package: a config file that's never half-written, and reading uploads with a size limit. Each block is typechecked against the release.

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- A `schema` option for `readJsonFile`, in the async and sync APIs, which validates the parsed content and types the result. Its errors propagate unchanged. `ISchema` and `IReadJsonFileOptions` are exported.
- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.

### Changed

- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- Error messages say what failed at that step and keep the error underneath as `cause`, instead of repeating its message, so `extractMessage` prints each layer of the chain once.
- `readJsonFile` returns `unknown` without a schema or a type argument, instead of `Record<string, unknown>`.
- `readJSONFile` and `writeJSONFile` are `readJsonFile` and `writeJsonFile`, in the async and sync APIs, so acronyms are cased as words, like every other name in the packages.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release.

### Added

- Async functions for paths, directories, and files, such as `getDirectoryElements`, `readJSONFile`, `writeFileAtomic`, and `readBoundedFile`.
- The `jg-fs/sync` entry, with the same functions, synchronous.
- `ERRORS`, the codes of every error the package throws.
- Empty content is allowed when reading and writing text and binary files, and `createDirectory` succeeds when the directory already exists.
