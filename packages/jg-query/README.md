# jg-query

TanStack Query for React apps: a client with safe defaults, opt-in IndexedDB persistence, and a sign-out clear that waits for restore.

## Install

```bash
npm install jg-query @tanstack/react-query @tanstack/react-query-persist-client
```

It needs React 19.2.4 and TanStack Query 5.100.14 or later.

## Usage

Create the client and its persister once, outside any component, and provide them at the root:

```ts
import { createElement } from 'react';
import { createIndexedDbPersister, createQueryClient, PersistedQueryProvider } from 'jg-query';

declare const App: () => null;

export const queryClient = createQueryClient();
export const persister = createIndexedDbPersister({
  databaseName: 'app-query-cache',
  storeName: 'queries',
  key: 'query-client',
});

export const Root = () =>
  createElement(
    PersistedQueryProvider,
    { client: queryClient, persister, buster: 'v1' },
    createElement(App),
  );
```

- **The client** never retries a query or a mutation, so an error shows at once and a failed write never repeats, and doesn't refetch when the window regains focus. Unused data stays in memory for `maxAgeSeconds`, 10 days by default, as long as it stays persisted.
- **Persistence is opt-in:** only a query with `meta: { persist: true }` is saved, once it succeeds, so private or short-lived data never reaches the disk. Mutations are never saved, since one replayed after a reload could act twice. Change `buster` when a release changes a persisted query's data, so older copies are thrown away.
- **Where IndexedDB is missing**, such as in some private windows, the provider provides the client without persistence, and the persister does nothing.

### Signing out

```ts
import { clearQueryCache } from 'jg-query';

declare const queryClient: Parameters<typeof clearQueryCache>[0];
declare const persister: Parameters<typeof clearQueryCache>[1];

export const signOut = async (): Promise<void> => {
  await clearQueryCache(queryClient, persister);
};
```

`clearQueryCache` waits for the client's restoration from its persisted copy, so restored data can't come back after the clear. It then clears the memory and removes the persisted copy, and concurrent calls share one clear.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-query/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-query/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-query/LICENSE)
