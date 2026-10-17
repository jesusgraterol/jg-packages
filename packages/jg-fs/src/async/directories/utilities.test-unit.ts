import { describe, expect, test } from 'vitest';

import { mapWithConcurrency } from './utilities.js';

describe('mapWithConcurrency', () => {
  test('never runs more than the limit at once, and keeps the results in order', async () => {
    let running = 0;
    let mostRunning = 0;
    const items = Array.from({ length: 100 }, (_, index) => index);

    const results = await mapWithConcurrency(items, 32, async (item) => {
      running += 1;
      mostRunning = Math.max(mostRunning, running);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, item % 3));
      running -= 1;
      return item * 2;
    });

    expect(mostRunning).toBe(32);
    expect(results).toStrictEqual(items.map((item) => item * 2));
  });

  test('handles fewer items than the limit, and no items', async () => {
    expect(await mapWithConcurrency([1, 2], 32, (item) => Promise.resolve(item + 1))).toStrictEqual(
      [2, 3],
    );
    expect(await mapWithConcurrency([], 32, (item: number) => Promise.resolve(item))).toStrictEqual(
      [],
    );
  });

  test('rejects with the first error', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, (item) =>
        item === 2 ? Promise.reject(new Error('failed on 2')) : Promise.resolve(item),
      ),
    ).rejects.toThrow('failed on 2');
  });
});
