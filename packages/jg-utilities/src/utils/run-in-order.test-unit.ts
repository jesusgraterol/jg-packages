// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToRejectCode } from 'jg-exception/testing';

import { runInOrder } from './run-in-order.js';

// a promise the test settles by hand
const createDeferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

// lets every pending promise callback run
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('runInOrder', () => {
  test('commits in the items order, whatever order they finish in, and returns the results', async () => {
    const deferreds = [
      createDeferred<string>(),
      createDeferred<string>(),
      createDeferred<string>(),
    ];
    const committed: string[] = [];
    const run = runInOrder([0, 1, 2], {
      concurrency: 3,
      execute: (index) => (deferreds[index] as ReturnType<typeof createDeferred<string>>).promise,
      commit: (result, item, index) => {
        committed.push(`${result}:${item}:${index}`);
      },
    });

    deferreds[2]?.resolve('c');
    deferreds[1]?.resolve('b');
    await flush();
    expect(committed).toStrictEqual([]);
    deferreds[0]?.resolve('a');

    await expect(run).resolves.toStrictEqual(['a', 'b', 'c']);
    expect(committed).toStrictEqual(['a:0:0', 'b:1:1', 'c:2:2']);
  });

  test('runs at most `concurrency` items, and starts a worker next item only after its commit', async () => {
    const deferreds = Array.from({ length: 5 }, () => createDeferred<number>());
    const started: number[] = [];
    const run = runInOrder([0, 1, 2, 3, 4], {
      concurrency: 2,
      execute: (index) => {
        started.push(index);
        return (deferreds[index] as ReturnType<typeof createDeferred<number>>).promise;
      },
    });

    await flush();
    expect(started).toStrictEqual([0, 1]);
    // item 1 finishes first, but waits uncommitted for item 0, so its worker starts nothing
    deferreds[1]?.resolve(1);
    await flush();
    expect(started).toStrictEqual([0, 1]);
    deferreds[0]?.resolve(0);
    await flush();
    expect(started).toStrictEqual([0, 1, 2, 3]);
    deferreds[2]?.resolve(2);
    deferreds[3]?.resolve(3);
    await flush();
    deferreds[4]?.resolve(4);

    await expect(run).resolves.toStrictEqual([0, 1, 2, 3, 4]);
  });

  test('stops new items at the first failure, leaves running ones uncommitted, and rejects with it', async () => {
    const deferreds = Array.from({ length: 4 }, () => createDeferred<number>());
    const started: number[] = [];
    const committed: number[] = [];
    const failure = new Error('item 1 failed');
    const run = runInOrder([0, 1, 2, 3], {
      concurrency: 2,
      execute: (index) => {
        started.push(index);
        return (deferreds[index] as ReturnType<typeof createDeferred<number>>).promise;
      },
      commit: (result) => {
        committed.push(result);
      },
    });

    await flush();
    deferreds[1]?.reject(failure);
    await flush();
    deferreds[0]?.resolve(0);

    await expect(run).rejects.toBe(failure);
    expect(started).toStrictEqual([0, 1]);
    expect(committed).toStrictEqual([]);
  });

  test('stops at a failed commit, with the items before it committed', async () => {
    const failure = new Error('checkpoint failed');
    const committed: number[] = [];

    await expect(
      runInOrder([0, 1, 2, 3], {
        concurrency: 1,
        execute: (item) => Promise.resolve(item),
        commit: (result) => {
          if (result === 2) {
            throw failure;
          }
          committed.push(result);
        },
      }),
    ).rejects.toBe(failure);
    expect(committed).toStrictEqual([0, 1]);
  });

  test('resolves to an empty array for no items', async () => {
    await expect(
      runInOrder([], { concurrency: 4, execute: () => Promise.resolve(1) }),
    ).resolves.toStrictEqual([]);
  });

  test.each([[0], [-1], [1.5], [NaN]])(
    'runInOrder(items, { concurrency: %d }) -> rejects with INVALID_CONCURRENCY_LIMIT',
    async (concurrency) => {
      await expectToRejectCode(
        runInOrder([1], { concurrency, execute: () => Promise.resolve(1) }),
        ERRORS.INVALID_CONCURRENCY_LIMIT,
      );
    },
  );
});
