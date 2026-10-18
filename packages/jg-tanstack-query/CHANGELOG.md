# Changelog

## 0.1.0

### Added

- `createQueryClient`, a TanStack Query client that never retries, doesn't refetch on window focus, and keeps unused data for `DEFAULT_QUERY_MAX_AGE_SECONDS`, 10 days.
- `createIndexedDbPersister`, which keeps a client's persisted copy in IndexedDB, opening it on first use.
- `PersistedQueryProvider`, which restores the persisted copy and saves only the queries that opt in with `meta: { persist: true }`, never mutations, and provides the client without persistence where IndexedDB is missing.
- `clearQueryCache`, which waits for the client's restoration, then clears its memory and its persisted copy.
