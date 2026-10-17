# Changelog

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
