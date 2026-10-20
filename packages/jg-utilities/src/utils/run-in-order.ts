import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import { isIntegerValid } from '../validations/index.js';

import type { IRunInOrderOptions } from './types.js';

/**
 * Runs items at most `concurrency` at a time and commits their results one at a time, in the items'
 * order, such as evaluations that run in parallel but are written to a checkpoint in a fixed
 * order. A worker starts its next item only after its previous one is committed, so at most
 * `concurrency` results wait uncommitted. The first failure, of an item or of a commit, stops new
 * items: the ones already running finish without being committed, and then the promise rejects
 * with that failure.
 * @param items The items.
 * @param options The concurrency, the function that runs an item, and the one that commits its
 * result.
 * @returns A promise that resolves to the results, in the items' order.
 * @example
 * import { runInOrder } from 'jg-utilities';
 *
 * const committed: number[] = [];
 * await runInOrder([3, 1, 2], {
 *   concurrency: 2,
 *   execute: async (seconds) => seconds * 10,
 *   commit: (result) => {
 *     committed.push(result);
 *   },
 * }); // => [30, 10, 20]
 * committed; // => [30, 10, 20]
 * @throws
 * - INVALID_CONCURRENCY_LIMIT: The concurrency limit must be an integer of at least 1.
 * - The first error an item's execute or commit throws.
 */
export const runInOrder = async <TItem, TResult>(
  items: readonly TItem[],
  { concurrency, execute, commit }: IRunInOrderOptions<TItem, TResult>,
): Promise<TResult[]> => {
  if (!isIntegerValid(concurrency, 1)) {
    throw new Exception('The concurrency limit must be an integer of at least 1.', {
      code: ERRORS.INVALID_CONCURRENCY_LIMIT,
      data: { concurrency: String(concurrency) },
    });
  }
  const results: TResult[] = [];
  // results that finished running and wait for the items before them to commit
  const finished = new Map<number, TResult>();
  // the workers waiting for their item to commit, by the item's index
  const waiting = new Map<number, () => void>();
  let nextIndex = 0;
  let failure: { error: unknown } | undefined;
  // commits run one at a time, each after the previous one settled
  let commits = Promise.resolve();

  const stop = (error: unknown): void => {
    failure ??= { error };
    for (const wake of waiting.values()) {
      wake();
    }
    waiting.clear();
  };

  const commitFinished = async (): Promise<void> => {
    while (failure === undefined && finished.has(results.length)) {
      const index = results.length;
      const result = finished.get(index) as TResult;
      finished.delete(index);
      try {
        await commit?.(result, items[index] as TItem, index);
      } catch (error) {
        stop(error);
        return;
      }
      results.push(result);
      waiting.get(index)?.();
      waiting.delete(index);
    }
  };

  const runWorker = async (): Promise<void> => {
    while (failure === undefined && nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      let result: TResult;
      try {
        result = await execute(items[index] as TItem, index);
      } catch (error) {
        stop(error);
        return;
      }
      if (failure !== undefined) {
        return;
      }
      const committed = new Promise<void>((resolve) => {
        waiting.set(index, resolve);
      });
      finished.set(index, result);
      commits = commits.then(commitFinished);
      await committed;
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  await commits;
  if (failure !== undefined) {
    throw failure.error;
  }
  return results;
};
