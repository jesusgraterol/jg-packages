# Changelog

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- `ISchema<T>`, the type of the `schema` option: anything with `parse(value: unknown): T`, such as a Zod schema.

### Changed

- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- Error messages say what failed at that step and keep the error underneath as `cause`, instead of repeating its message, so `extractMessage` prints each layer of the chain once.
- The `schema` option replaces `parse`: pass the schema itself, such as `schema: Settings`, and the store's record type comes from it. Its errors propagate unchanged.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release of `jg-storage`, which replaces `browser-keyval-stores` 1.1.1. Records written by `browser-keyval-stores` read back unchanged.

### Added

- `createLocalStore`, `createSessionStore`, `createMemoryStore`, and `createIndexedDbStore`, which replace the store classes.
- The `fallback: 'memory'` and `parse` options.
- `ERRORS`, the codes of every error the package throws, with the new `STORE_UNAVAILABLE` code.

### Changed

- Web storage stores accept any value JSON can represent, primitives included.
- A store whose mechanism is unavailable keeps records in memory only with `fallback: 'memory'`. Without it, `set` and `del` throw `STORE_UNAVAILABLE`.
- Web storage is read from `globalThis` on a store's first call, never from `window`.
- `IRecordID` is renamed to `IRecordId`, and the store interfaces to `ISyncStore` and `IAsyncStore`.
- Errors are `Exception`s from `jg-exception`.

### Removed

- The `LocalStorageStore`, `SessionStorageStore`, and `IndexedDBStore` classes.
- The `INVALID_JSON_DATA` code.
