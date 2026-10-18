# jg-tanstack-query recipes

Patterns for React apps that cache server data with TanStack Query: setting it up, keeping a query across reloads, and signing out without leaking data.

## Setting up the client at the root

Create the client and its persister in their own module, so every part of the app shares them:

```tsx
import {
  createIndexedDbPersister,
  createQueryClient,
  PersistedQueryProvider,
} from 'jg-tanstack-query';
import type { ReactNode } from 'react';

export const queryClient = createQueryClient();
export const persister = createIndexedDbPersister({
  databaseName: 'app-query-cache',
  storeName: 'queries',
  key: 'query-client',
});

// bump it when a release changes a persisted query's data, so older copies are thrown away
const CACHE_VERSION = 'v3';

export const QueryRoot = ({ children }: { children: ReactNode }) => (
  <PersistedQueryProvider
    client={queryClient}
    persister={persister}
    buster={CACHE_VERSION}
  >
    {children}
  </PersistedQueryProvider>
);
```

## Keeping a query across reloads

Persist what's public and slow to load, such as a catalog, so the next visit renders it at once and refreshes it in the background:

```tsx
import { useQuery } from '@tanstack/react-query';

declare const fetchCatalog: () => Promise<{ id: string; name: string }[]>;

export const Catalog = () => {
  const { data, isPending } = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    meta: { persist: true },
    staleTime: 60_000,
  });
  if (isPending) {
    return <p>Loading…</p>;
  }
  return (
    <ul>
      {data?.map(({ id, name }) => (
        <li key={id}>{name}</li>
      ))}
    </ul>
  );
};
```

Leave `meta.persist` off anything personal, such as an account's details or messages: it would sit on the disk after the session ends.

## Signing out without leaking data

Clear the cache before the next person can use the device, and wait for the clear before showing the sign-in page:

```tsx
import { clearQueryCache, createIndexedDbPersister, createQueryClient } from 'jg-tanstack-query';

declare const queryClient: ReturnType<typeof createQueryClient>;
declare const persister: ReturnType<typeof createIndexedDbPersister>;
declare const endSession: () => Promise<void>;
declare const navigate: (path: string) => void;

export const SignOutButton = () => {
  const signOut = async (): Promise<void> => {
    await endSession();
    await clearQueryCache(queryClient, persister);
    navigate('/sign-in');
  };
  return (
    <button
      type="button"
      onClick={() => void signOut()}
    >
      Sign out
    </button>
  );
};
```

When sign-out happens right after the page loads, the clear waits for the persisted copy to finish restoring, so restored data can't come back afterwards.
