/*
 * TanStack Query schedules no interval where window is undefined, so these run in a browser.
 */
import { focusManager, onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createPollingQueryOptions } from './polling.js';

let client: QueryClient;
let unsubscribe: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // QueryClientProvider mounts its client, which makes focus and reconnects reach the queries
  client.mount();
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = undefined;
  client.clear();
  client.unmount();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

/**
 * Observes a query that polls, as a mounted useQuery would.
 * @param queryFn The query's function.
 * @param options The polling options.
 */
const observe = <TData>(
  queryFn: () => Promise<TData>,
  options: Parameters<typeof createPollingQueryOptions<TData>>[0],
): void => {
  const observer = new QueryObserver(client, {
    queryKey: ['polled'],
    queryFn,
    ...createPollingQueryOptions<TData>(options),
  });
  unsubscribe = observer.subscribe(() => undefined);
};

describe('createPollingQueryOptions', () => {
  test('fetches every interval while the query succeeds', async () => {
    const queryFn = vi.fn(() => Promise.resolve(1));
    observe(queryFn, { intervalSeconds: 10 });

    await vi.advanceTimersByTimeAsync(30_000);

    expect(queryFn).toHaveBeenCalledTimes(4);
  });

  test('pauses while the tab is hidden, and fetches once when it comes back', async () => {
    const queryFn = vi.fn(() => Promise.resolve(1));
    observe(queryFn, { intervalSeconds: 10 });
    await vi.advanceTimersByTimeAsync(0);

    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(queryFn).toHaveBeenCalledOnce();

    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  test('fetches once when the network comes back', async () => {
    const queryFn = vi.fn(() => Promise.resolve(1));
    observe(queryFn, { intervalSeconds: 10 });
    await vi.advanceTimersByTimeAsync(0);

    onlineManager.setOnline(false);
    await vi.advanceTimersByTimeAsync(25_000);
    const callsWhileOffline = queryFn.mock.calls.length;
    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(queryFn.mock.calls.length).toBe(callsWhileOffline + 1);
  });

  test('stops after a failed fetch, without refetching on focus or reconnect', async () => {
    const queryFn = vi.fn(() => Promise.reject(new Error('unavailable')));
    observe(queryFn, { intervalSeconds: 10 });

    await vi.advanceTimersByTimeAsync(60_000);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(queryFn).toHaveBeenCalledOnce();
  });

  test('follows an interval the data gives, stopping when it gives false', async () => {
    let call = 0;
    const queryFn = vi.fn(() => {
      call += 1;
      return Promise.resolve({ status: call < 3 ? 'running' : 'done' });
    });
    observe(queryFn, {
      intervalSeconds: (data: { status: string }) => (data.status === 'running' ? 2 : false),
    });

    await vi.advanceTimersByTimeAsync(20_000);

    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  test('never polls, refetches on focus, or on reconnect while isEnabled is false', async () => {
    const queryFn = vi.fn(() => Promise.resolve(1));
    observe(queryFn, { intervalSeconds: 10, isEnabled: false });

    await vi.advanceTimersByTimeAsync(30_000);
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(queryFn).toHaveBeenCalledOnce();
  });
});
