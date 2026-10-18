import { defaultShouldDehydrateQuery, type Query } from '@tanstack/react-query';

/**
 * Picks the queries a client persists: the ones that succeeded and opted in with
 * `meta: { persist: true }`, so private or short-lived data never reaches the disk.
 * @param query The query.
 * @returns Whether it's persisted.
 */
export const shouldPersistQuery = (query: Query): boolean =>
  defaultShouldDehydrateQuery(query) && query.meta?.['persist'] === true;

/**
 * Picks the mutations a client persists: none, since a mutation replayed after a reload could
 * act twice.
 * @returns Always false.
 */
export const shouldPersistMutation = (): boolean => false;
