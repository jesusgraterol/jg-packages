# Changelog

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
