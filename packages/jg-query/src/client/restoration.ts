import type { QueryClient } from '@tanstack/react-query';

// a client's restoration from its persisted copy: the promise that settles when it's done, and
// the function that settles it
type IRestoration = { promise: Promise<void>; finish: () => void };

// each client's restoration, from the moment a PersistedQueryProvider renders it
const RESTORATIONS = new WeakMap<QueryClient, IRestoration>();

/**
 * Starts tracking a client's restoration, once per client, so clearQueryCache can wait for it.
 * @param client The client.
 * @returns The restoration.
 */
export const trackRestoration = (client: QueryClient): IRestoration => {
  const tracked = RESTORATIONS.get(client);
  if (tracked !== undefined) {
    return tracked;
  }
  let finish: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const restoration = { promise, finish };
  RESTORATIONS.set(client, restoration);
  return restoration;
};

/**
 * Waits for a client's restoration, or resolves at once when nothing restores it.
 * @param client The client.
 * @returns A promise that resolves once the restoration is done.
 */
export const waitForRestoration = (client: QueryClient): Promise<void> =>
  RESTORATIONS.get(client)?.promise ?? Promise.resolve();
