import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';
import type { IPolledQuery, IPollingOptions, IPollingQueryOptions } from './types.js';

/**
 * Checks an interval, in seconds, and gives it in milliseconds.
 * @param seconds The interval.
 * @returns The milliseconds.
 * @throws
 * - INVALID_POLLING_INTERVAL: The polling interval must be positive, finite seconds.
 */
const toIntervalMs = (seconds: number): number => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    throw new Exception('The polling interval must be positive, finite seconds.', {
      code: ERRORS.INVALID_POLLING_INTERVAL,
      data: { intervalSeconds: String(seconds) },
    });
  }
  return seconds * 1_000;
};

/**
 * Builds the options of a query that polls while it's useful: every `intervalSeconds` while it's
 * enabled and its last fetch succeeded, on TanStack Query's own focus and online managers, so it
 * pauses in a hidden tab, fetches once when the tab or the network comes back, and stops after a
 * failed fetch, until something else refetches it. The interval can follow the data, such as
 * stopping once a job finished. Spread the result into useQuery's options.
 * @param options The interval in seconds, or a function of the data, and whether to poll.
 * @returns The query options.
 * @example
 * import { useQuery } from '@tanstack/react-query';
 * import { createPollingQueryOptions } from 'jg-tanstack-query';
 *
 * type IExport = { status: 'running' | 'done'; url: string | null };
 * declare const fetchExport: (id: string) => Promise<IExport>;
 *
 * export const useExport = (id: string) =>
 *   useQuery({
 *     queryKey: ['exports', id],
 *     queryFn: () => fetchExport(id),
 *     ...createPollingQueryOptions<IExport>({
 *       intervalSeconds: (data) => (data.status === 'running' ? 2 : false),
 *     }),
 *   });
 * @throws
 * - INVALID_POLLING_INTERVAL: The polling interval must be positive, finite seconds.
 */
export const createPollingQueryOptions = <TData>({
  intervalSeconds,
  isEnabled = true,
}: IPollingOptions<TData>): IPollingQueryOptions<TData> => {
  if (typeof intervalSeconds !== 'function') {
    toIntervalMs(intervalSeconds);
  }
  const isPolling = (query: IPolledQuery<TData>): boolean =>
    isEnabled && query.state.status === 'success';
  return {
    refetchInterval: (query) => {
      if (!isPolling(query)) {
        return false;
      }
      const seconds =
        typeof intervalSeconds === 'function'
          ? intervalSeconds(query.state.data as TData)
          : intervalSeconds;
      return seconds === false ? false : toIntervalMs(seconds);
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: isPolling,
    refetchOnReconnect: isPolling,
  };
};
