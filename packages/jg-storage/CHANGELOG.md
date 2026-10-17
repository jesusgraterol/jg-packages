# Changelog

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- `ISchema<T>`, the type of the `schema` option: anything with `parse(value: unknown): T`, such as a Zod schema.
- `INVALID_STORE_ID`, which every factory throws for a store id with anything but letters, digits, underscores, and hyphens.

### Changed

- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- Error messages say what failed at that step and keep the error underneath as `cause`, instead of repeating its message, so `extractMessage` prints each layer of the chain once.
- The `schema` option replaces `parse`: pass the schema itself, such as `schema: Settings`, and the store's record type comes from it. Its errors propagate unchanged.
- Stores use their own layout. Web storage keys are `jg-storage:<storeId>` for the root record and `jg-storage:<storeId>:<recordId>` for the others, IndexedDB records live in the `records` object store of the `jg-storage` database under `[storeId]` and `[storeId, recordId]`, and the availability probe uses the key `jg-storage-probe`, which no record can have. Records written by 1.0.x aren't read.
- Record ids become strings in every mechanism, so `1` and `'1'` address the same record.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release.

### Added

- `createLocalStore`, `createSessionStore`, `createMemoryStore`, and `createIndexedDbStore`, typed key-value stores that work in browsers and workers.
- The `fallback: 'memory'` and `parse` options. Without `fallback: 'memory'`, a store whose mechanism is unavailable throws `STORE_UNAVAILABLE` from `set` and `del`.
- `ERRORS`, the codes of every error the package throws.
