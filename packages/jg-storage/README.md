# jg-storage

Typed key-value stores over localStorage, sessionStorage, IndexedDB, and memory, for browsers and workers.

## Install

```bash
npm install jg-storage
```

## Usage

Keep settings in localStorage, with a root record and records by ID:

```ts
import { createLocalStore } from 'jg-storage';

const settings = createLocalStore<{ theme: 'light' | 'dark' }>('settings');
settings.set(undefined, { theme: 'dark' }); // stored under the key 'settings'
settings.get(); // { theme: 'dark' }
settings.set('draft', { theme: 'light' }); // stored under the key 'settings_draft'
settings.del('draft');
```

Keep records in IndexedDB, from a page or a service worker:

```ts
import { createIndexedDbStore } from 'jg-storage';

const devices = createIndexedDbStore<{ token: string }>('devices');
await devices.set('phone', { token: 'abc' });
await devices.get('phone'); // { token: 'abc' }
```

Validate what you read, and fall back to memory where storage is blocked:

```ts
import { createSessionStore, ERRORS } from 'jg-storage';
import { hasErrorCode } from 'jg-exception';
import { z } from 'zod';

const Step = z.number().int().min(1);
const wizard = createSessionStore('wizard-step', {
  fallback: 'memory', // without it, set and del throw STORE_UNAVAILABLE
  parse: (value) => Step.parse(value), // runs on every stored value get reads
});
wizard.set(undefined, 2);
wizard.get(); // 2

try {
  createSessionStore('other').set(undefined, 1);
} catch (error) {
  if (hasErrorCode(error, ERRORS.STORE_UNAVAILABLE)) {
    // sessionStorage is unavailable in this context
  }
}
```

Every store probes its mechanism on its first call, never when it's created, so creating stores at module scope is safe during server-side rendering.

## Coming from `browser-keyval-stores`

| `browser-keyval-stores`                            | `jg-storage`                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `new LocalStorageStore<T>(id)`                     | `createLocalStore<T>(id, options?)`                                             |
| `new SessionStorageStore<T>(id)`                   | `createSessionStore<T>(id, options?)`                                           |
| `new IndexedDBStore<T>(id)`                        | `createIndexedDbStore<T>(id, options?)`                                         |
| the internal temp-memory store                     | `createMemoryStore<T>(id, options?)`                                            |
| `ILocalStorageStore<T>`, `ISessionStorageStore<T>` | `ISyncStore<T>`                                                                 |
| `IIndexedDBStore<T>`                               | `IAsyncStore<T>`                                                                |
| `IRecordID`                                        | `IRecordId`                                                                     |
| the silent memory fallback                         | `{ fallback: 'memory' }`; without it, `set` and `del` throw `STORE_UNAVAILABLE` |
| the codes, not exported                            | `ERRORS`                                                                        |

`IStoreMechanism` and the `get`, `set`, and `del` methods keep their names and argument order.

- Stored data is compatible: the keys, the compatibility probe's record, idb-keyval's default `keyval-store` database, JSON values in web storage, and structured-clone values in IndexedDB are all the same, so records written by `browser-keyval-stores` read back unchanged.
- `set` on a web storage store accepts any value JSON can represent, primitives included. It used to accept only objects and arrays and throw `INVALID_JSON_DATA`, which is gone. A value JSON can't represent, such as `undefined` or a `bigint`, throws `FAILED_TO_STRINGIFY_JSON`.
- When a mechanism is unavailable, a store without `fallback: 'memory'` returns `undefined` from `get` and throws `STORE_UNAVAILABLE` from `set` and `del`, instead of silently keeping records in memory.
- The new `parse` option runs on every stored value `get` reads, and its errors propagate.
- Nothing reads `window`: web storage is read from `globalThis` on the first call, and IndexedDB keeps using `globalThis.indexedDB`, so the IndexedDB store also works in workers.
- Errors are `Exception`s from `jg-exception`.

## Documentation

The full API reference is at https://jg-packages.jesusgraterol.dev/packages/jg-storage/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-storage/LICENSE)
