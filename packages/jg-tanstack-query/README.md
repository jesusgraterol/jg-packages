# jg-tanstack-query

TanStack Query for React apps: a client with safe defaults, opt-in IndexedDB persistence, and a sign-out clear that waits for restore.

## Install

```bash
npm install jg-tanstack-query @tanstack/react-query @tanstack/react-query-persist-client
```

It needs React 19.2.4 and TanStack Query 5.100.14 or later.

## Usage

Create the client and its persister once, outside any component, and provide them at the root:

```ts
import { createElement } from 'react';
import {
  createIndexedDbPersister,
  createQueryClient,
  PersistedQueryProvider,
} from 'jg-tanstack-query';

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
import { clearQueryCache } from 'jg-tanstack-query';

declare const queryClient: Parameters<typeof clearQueryCache>[0];
declare const persister: Parameters<typeof clearQueryCache>[1];

export const signOut = async (): Promise<void> => {
  await clearQueryCache(queryClient, persister);
};
```

`clearQueryCache` waits for the client's restoration from its persisted copy, so restored data can't come back after the clear. It then clears the memory and removes the persisted copy, and concurrent calls share one clear.

### Paging after a first page

When one query loads a whole screen, including the first page of a list, `useSeededInfiniteQuery` pages through the rest of the list without fetching that first page again:

```ts
import { useQuery } from '@tanstack/react-query';
import { useSeededInfiniteQuery } from 'jg-tanstack-query';

const screen = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard });
const activity = useSeededInfiniteQuery<IActivityPage, string | null>({
  queryKey: ['dashboard', 'activity'],
  firstPage: screen.data?.activity,
  firstPageUpdatedAt: screen.dataUpdatedAt,
  initialPageParam: null,
  getNextPageParam: (page) => page.nextCursor,
  continuationQueryFn: (cursor, signal) => fetchActivity(cursor, signal),
});
// activity.data.pages, activity.fetchNextPage(), activity.hasNextPage
```

Each `firstPageUpdatedAt` and first page form a generation. When the screen's query refetches, the list starts over from its new first page, any page in flight is aborted, and a late page of an older generation is dropped. Until the generation is published, the result is loading, with no data. Components using the same key share one generation, so one unmounting aborts nothing. `fetchNextPage` and `refetch`, which retries only the page that failed, keep their identity. The query never fetches by itself and is never persisted; `gcTimeSeconds`, 0 by default, keeps its pages after the last component unmounts. Something that forces it to fetch before the first page arrives rejects with `FIRST_PAGE_NOT_READY`.

### Query state

The query-state helpers read the flags of any query, or of `useSeededInfiniteQuery`'s result: `isQueryLoading`, `isQueryReadyForInitialDisplay`, which holds back stale cached data until it's refetched after mount, `canQueryLoadMore`, `isQueryLoadingMore`, and `isQueryResultDataAvailable`, for a list of queries.

### Query boundaries

`useQueryBoundary` decides what a screen shows around the queries its content needs, and leaves the drawing to the app:

```ts
import { useQueryBoundary } from 'jg-tanstack-query';

const boundary = useQueryBoundary({
  queries: [project, members],
  resolutionKey: projectId, // a new key hides the content until its queries resolve
  isAccessDenied: (error) => getErrorCode(error) === 'ACCESS_DENIED',
});
// { canRenderContent, isLoaderVisible, hasError, errorPresentation, failedQueries,
//   loadMoreQuery, retryFailed }
```

The content waits until every query has data for the key that's fresh, or fetched since mount, so cached data from an earlier visit never shows as current. Once it shows, refetches, pagination, and background errors keep it on screen, with `errorPresentation: 'retained'`; an error before then, or one that leaves a query without data, is `blocking`. A new key, or an error `isAccessDenied` recognizes, hides the content in the same render, and after an access loss it returns only once every query settles with current data, even when `isInitialResolutionApproved` says the app approved the key's data before. `loadMoreQuery` is the first query when it pages and the content shows, and `retryFailed` refetches every failed query; it and the result keep their identity while nothing changes. RECIPES.md has an unstyled boundary component.

### Errors

| Code                   | When                                                                      |
| ---------------------- | ------------------------------------------------------------------------- |
| `FIRST_PAGE_NOT_READY` | A seeded infinite query was forced to fetch before its first page arrived |

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-tanstack-query/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-tanstack-query/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-tanstack-query/LICENSE)
