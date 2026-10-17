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
settings.set(undefined, { theme: 'dark' }); // stored under the key 'jg-storage:settings'
settings.get(); // { theme: 'dark' }
settings.set('draft', { theme: 'light' }); // stored under the key 'jg-storage:settings:draft'
settings.del('draft');
```

Store ids hold only letters, digits, underscores, and hyphens; any other id throws `INVALID_STORE_ID`. Record ids become strings, so `1` and `'1'` address the same record.

Keep records in IndexedDB, from a page or a service worker. They live in the `records` object store of the `jg-storage` database:

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
  schema: Step, // validates every stored value get reads; its errors propagate unchanged
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

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-storage/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-storage/LICENSE)
