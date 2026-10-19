// @vitest-environment node
import type { UseQueryOptions } from '@tanstack/react-query';
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { createPollingQueryOptions } from './polling.js';
import type { IPolledQuery } from './types.js';

/**
 * Builds a query in a state.
 * @param status The query's status.
 * @param data Its data.
 * @returns The query.
 */
const query = <TData>(
  status: IPolledQuery<TData>['state']['status'],
  data?: TData,
): IPolledQuery<TData> => ({ state: { status, data } });

describe('createPollingQueryOptions', () => {
  test('polls in milliseconds, and refetches on focus and reconnect, only while the query succeeds', () => {
    const options = createPollingQueryOptions<number>({ intervalSeconds: 2.5 });

    expect(options.refetchInterval(query('success', 1))).toBe(2_500);
    expect(options.refetchOnWindowFocus(query('success', 1))).toBe(true);
    expect(options.refetchOnReconnect(query('success', 1))).toBe(true);
    for (const status of ['pending', 'error'] as const) {
      expect(options.refetchInterval(query(status))).toBe(false);
      expect(options.refetchOnWindowFocus(query(status))).toBe(false);
      expect(options.refetchOnReconnect(query(status))).toBe(false);
    }
    expect(options.refetchIntervalInBackground).toBe(false);
  });

  test('polls at nothing while isEnabled is false', () => {
    const options = createPollingQueryOptions<number>({ intervalSeconds: 5, isEnabled: false });

    expect(options.refetchInterval(query('success', 1))).toBe(false);
    expect(options.refetchOnWindowFocus(query('success', 1))).toBe(false);
  });

  test('follows an interval the data gives, or stops when it gives false', () => {
    const options = createPollingQueryOptions<{ status: string }>({
      intervalSeconds: (data) => (data.status === 'running' ? 2 : false),
    });

    expect(options.refetchInterval(query('success', { status: 'running' }))).toBe(2_000);
    expect(options.refetchInterval(query('success', { status: 'done' }))).toBe(false);
  });

  test('spreads into useQuery options', () => {
    const options: UseQueryOptions<number> = {
      queryKey: ['typed'],
      queryFn: () => Promise.resolve(1),
      ...createPollingQueryOptions<number>({ intervalSeconds: 5 }),
    };

    expect(options.refetchIntervalInBackground).toBe(false);
  });

  test.each([
    ['0', 0],
    ['a negative interval', -1],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
  ])('throws INVALID_POLLING_INTERVAL for %s', (_, intervalSeconds) => {
    expectToThrowCode(
      () => createPollingQueryOptions({ intervalSeconds }),
      ERRORS.INVALID_POLLING_INTERVAL,
      'The polling interval must be positive, finite seconds.',
    );
  });

  test('throws INVALID_POLLING_INTERVAL for an interval the data gives that is not valid', () => {
    const { refetchInterval } = createPollingQueryOptions<number>({ intervalSeconds: () => 0 });

    expectToThrowCode(() => refetchInterval(query('success', 1)), ERRORS.INVALID_POLLING_INTERVAL);
  });
});
