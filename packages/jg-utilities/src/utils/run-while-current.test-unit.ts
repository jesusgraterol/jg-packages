// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import { runWhileCurrent } from './run-while-current.js';

// a store of the signed-in account, with the subscribe function Zustand stores have
const createAccountStore = (initial: string) => {
  let account = initial;
  const listeners = new Set<() => void>();
  return {
    read: () => account,
    change: (next: string): void => {
      account = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    listenerCount: () => listeners.size,
  };
};

// the error runWhileCurrent throws when the account changed
class StaleError extends Error {}

// the options for work started for account-1
const optionsFor = (store: ReturnType<typeof createAccountStore>, signal?: AbortSignal) => ({
  isCurrent: () => store.read() === 'account-1',
  subscriptions: [store.subscribe],
  createStaleError: (cause: unknown) => new StaleError('The account changed.', { cause }),
  signal,
});

// a promise the test settles by hand
const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('runWhileCurrent', () => {
  test('resolves to the result while current, and unsubscribes', async () => {
    const store = createAccountStore('account-1');

    await expect(
      runWhileCurrent(() => Promise.resolve('profile'), optionsFor(store)),
    ).resolves.toBe('profile');
    expect(store.subscribe).toHaveBeenCalledTimes(1);
    expect(store.listenerCount()).toBe(0);
  });

  test('passes the work its own error while current', async () => {
    const store = createAccountStore('account-1');
    const failure = new Error('server error');

    await expect(runWhileCurrent(() => Promise.reject(failure), optionsFor(store))).rejects.toBe(
      failure,
    );
  });

  test('throws stale without running the work when it is not current at the start', async () => {
    const store = createAccountStore('account-2');
    const run = vi.fn(() => Promise.resolve('profile'));

    const error = await runWhileCurrent(run, optionsFor(store)).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(StaleError);
    expect((error as StaleError).cause).toBeUndefined();
    expect(run).not.toHaveBeenCalled();
    expect(store.listenerCount()).toBe(0);
  });

  test("throws the caller's abort reason without running when the signal was already aborted", async () => {
    const store = createAccountStore('account-2');
    const run = vi.fn(() => Promise.resolve('profile'));

    await expect(runWhileCurrent(run, optionsFor(store, AbortSignal.abort('left')))).rejects.toBe(
      'left',
    );
    expect(run).not.toHaveBeenCalled();
    expect(store.listenerCount()).toBe(0);
  });

  test('aborts the work when it goes stale, and stays stale after the state changes back', async () => {
    const store = createAccountStore('account-1');
    const deferred = createDeferred<string>();
    let workSignal: AbortSignal | undefined;
    const running = runWhileCurrent((signal) => {
      workSignal = signal;
      return deferred.promise;
    }, optionsFor(store));

    store.change('account-2');
    expect(workSignal?.aborted).toBe(true);
    store.change('account-1');
    deferred.resolve('late profile');

    await expect(running).rejects.toBeInstanceOf(StaleError);
    expect(store.listenerCount()).toBe(0);
  });

  test('turns a rejection after a change into a stale error, with the rejection as its cause', async () => {
    const store = createAccountStore('account-1');
    const deferred = createDeferred<string>();
    const running = runWhileCurrent(() => deferred.promise, optionsFor(store));
    const aborted = new Error('aborted');

    store.change('account-2');
    deferred.reject(aborted);
    const error = await running.catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(StaleError);
    expect((error as StaleError).cause).toBe(aborted);
  });

  test('throws stale when the account changed without a store notification', async () => {
    const store = createAccountStore('account-1');
    const failure = new Error('unauthorized');

    const error = await runWhileCurrent(() => {
      // a change this test's store doesn't announce, as when a check reads another source
      store.read = () => 'account-2';
      return Promise.reject(failure);
    }, optionsFor(store)).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(StaleError);
    expect((error as StaleError).cause).toBe(failure);
  });

  test('ignores a store change that leaves the work current', async () => {
    const store = createAccountStore('account-1');
    let workSignal: AbortSignal | undefined;

    const result = await runWhileCurrent((signal) => {
      workSignal = signal;
      store.change('account-1');
      return Promise.resolve('profile');
    }, optionsFor(store));

    expect(result).toBe('profile');
    expect(workSignal?.aborted).toBe(false);
  });

  test("aborts the work with the caller's reason, and throws it after a late success", async () => {
    const store = createAccountStore('account-1');
    const controller = new AbortController();
    const deferred = createDeferred<string>();
    let workSignal: AbortSignal | undefined;
    const running = runWhileCurrent(
      (signal) => {
        workSignal = signal;
        return deferred.promise;
      },
      optionsFor(store, controller.signal),
    );

    controller.abort('navigated away');
    expect(workSignal?.reason).toBe('navigated away');
    deferred.resolve('profile');

    await expect(running).rejects.toBe('navigated away');
  });

  test("passes on the work's rejection after the caller aborts", async () => {
    const store = createAccountStore('account-1');
    const controller = new AbortController();

    const running = runWhileCurrent(
      (signal) =>
        new Promise<string>((_, reject) => {
          signal.addEventListener('abort', () => {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rejects with the signal's reason, as native APIs do
            reject(signal.reason);
          });
        }),
      optionsFor(store, controller.signal),
    );
    controller.abort('navigated away');

    await expect(running).rejects.toBe('navigated away');
  });
});
